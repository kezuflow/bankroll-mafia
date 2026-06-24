use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("H8xb7nuoB6uv9V9Eye1c8CWFuefcdDXwLri4VTd1mSyj");

const CONFIG_SEED: &[u8] = b"config";
const VAULT_SEED: &[u8] = b"vault";
const HEIST_SEED: &[u8] = b"heist";
const MAX_TIER: u8 = 3;
const MAX_CREW_ID: u8 = 7;
const CREW_COUNT: usize = 4;
const BASIS_POINTS_DENOMINATOR: u64 = 10_000;
const TIER_MIN_COSTS: [u64; 4] = [1_000_000, 100_000_000, 1_000_000_000, 10_000_000_000];
const TIER_MAX_COSTS: [u64; 4] = [50_000_000, 500_000_000, 5_000_000_000, 50_000_000_000];
const TIER_MAX_PAYOUT_MULTIPLIERS_BPS: [u64; 4] = [200_000, 150_000, 100_000, 50_000];

#[program]
pub mod bankroll_mafia {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        resolver_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        config.admin = ctx.accounts.admin.key();
        config.resolver_authority = resolver_authority;
        config.paused = false;
        config.bump = ctx.bumps.config;

        Ok(())
    }

    pub fn initialize_tier_vault(ctx: Context<InitializeTierVault>, tier: u8) -> Result<()> {
        require!(tier <= MAX_TIER, BankrollError::InvalidTier);

        let vault = &mut ctx.accounts.tier_vault;

        vault.tier = tier;
        vault.bump = ctx.bumps.tier_vault;
        vault.total_deposits = 0;
        vault.total_payouts = 0;
        vault.reserved_payouts = 0;

        Ok(())
    }

    pub fn enter_heist(
        ctx: Context<EnterHeist>,
        tier: u8,
        idempotency_seed: [u8; 16],
        target_id: [u8; 32],
        crew_ids: [u8; CREW_COUNT],
        heist_cost_lamports: u64,
    ) -> Result<()> {
        require!(tier <= MAX_TIER, BankrollError::InvalidTier);
        require!(!ctx.accounts.config.paused, BankrollError::GamePaused);
        require!(
            ctx.accounts.tier_vault.tier == tier,
            BankrollError::WrongTierVault
        );
        assert_valid_heist_cost(tier, heist_cost_lamports)?;
        assert_valid_crews(&crew_ids)?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.tier_vault.to_account_info(),
                },
            ),
            heist_cost_lamports,
        )?;

        let heist = &mut ctx.accounts.heist;

        heist.player = ctx.accounts.player.key();
        heist.tier = tier;
        heist.idempotency_seed = idempotency_seed;
        heist.target_id = target_id;
        heist.crew_ids = crew_ids;
        heist.heist_cost_lamports = heist_cost_lamports;
        heist.status = HeistStatus::Pending;
        heist.outcome = 0;
        heist.payout_lamports = 0;
        heist.bump = ctx.bumps.heist;

        let vault = &mut ctx.accounts.tier_vault;
        vault.total_deposits = vault
            .total_deposits
            .checked_add(heist_cost_lamports)
            .ok_or(BankrollError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn settle_heist(
        ctx: Context<SettleHeist>,
        outcome: u8,
        payout_lamports: u64,
    ) -> Result<()> {
        require!(outcome <= 4, BankrollError::InvalidOutcome);
        require!(
            ctx.accounts.heist.status == HeistStatus::Pending,
            BankrollError::InvalidHeistStatus
        );
        require!(
            ctx.accounts.tier_vault.tier == ctx.accounts.heist.tier,
            BankrollError::WrongTierVault
        );
        assert_valid_payout(
            ctx.accounts.heist.tier,
            ctx.accounts.heist.heist_cost_lamports,
            payout_lamports,
        )?;

        if payout_lamports > 0 {
            let vault_info = ctx.accounts.tier_vault.to_account_info();
            let player_info = ctx.accounts.player.to_account_info();
            let rent_floor = Rent::get()?.minimum_balance(8 + TierVault::LEN);
            let vault_lamports = vault_info.lamports();

            require!(
                vault_lamports >= rent_floor.saturating_add(payout_lamports),
                BankrollError::InsufficientVaultFunds
            );

            **vault_info.try_borrow_mut_lamports()? = vault_lamports
                .checked_sub(payout_lamports)
                .ok_or(BankrollError::ArithmeticOverflow)?;
            **player_info.try_borrow_mut_lamports()? = player_info
                .lamports()
                .checked_add(payout_lamports)
                .ok_or(BankrollError::ArithmeticOverflow)?;
        }

        let heist = &mut ctx.accounts.heist;
        heist.status = HeistStatus::Settled;
        heist.outcome = outcome;
        heist.payout_lamports = payout_lamports;

        let vault = &mut ctx.accounts.tier_vault;
        vault.total_payouts = vault
            .total_payouts
            .checked_add(payout_lamports)
            .ok_or(BankrollError::ArithmeticOverflow)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProgramConfig::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        constraint = program.key() == crate::ID,
        constraint = program.programdata_address()? == Some(program_data.key())
    )]
    pub program: Program<'info>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key())
    )]
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tier: u8)]
pub struct InitializeTierVault<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        init,
        payer = admin,
        space = 8 + TierVault::LEN,
        seeds = [VAULT_SEED, &[tier]],
        bump
    )]
    pub tier_vault: Account<'info, TierVault>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tier: u8, idempotency_seed: [u8; 16])]
pub struct EnterHeist<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [VAULT_SEED, &[tier]],
        bump = tier_vault.bump
    )]
    pub tier_vault: Account<'info, TierVault>,
    #[account(
        init,
        payer = player,
        space = 8 + Heist::LEN,
        seeds = [HEIST_SEED, player.key().as_ref(), idempotency_seed.as_ref()],
        bump
    )]
    pub heist: Account<'info, Heist>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleHeist<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = resolver_authority
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [VAULT_SEED, &[heist.tier]],
        bump = tier_vault.bump
    )]
    pub tier_vault: Account<'info, TierVault>,
    #[account(
        mut,
        seeds = [HEIST_SEED, player.key().as_ref(), heist.idempotency_seed.as_ref()],
        bump = heist.bump,
        has_one = player
    )]
    pub heist: Account<'info, Heist>,
    #[account(mut)]
    pub player: SystemAccount<'info>,
    pub resolver_authority: Signer<'info>,
}

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub resolver_authority: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

impl ProgramConfig {
    pub const LEN: usize = 32 + 32 + 1 + 1;
}

#[account]
pub struct TierVault {
    pub tier: u8,
    pub bump: u8,
    pub total_deposits: u64,
    pub total_payouts: u64,
    pub reserved_payouts: u64,
}

impl TierVault {
    pub const LEN: usize = 1 + 1 + 8 + 8 + 8;
}

#[account]
pub struct Heist {
    pub player: Pubkey,
    pub tier: u8,
    pub idempotency_seed: [u8; 16],
    pub target_id: [u8; 32],
    pub crew_ids: [u8; CREW_COUNT],
    pub heist_cost_lamports: u64,
    pub status: HeistStatus,
    pub outcome: u8,
    pub payout_lamports: u64,
    pub bump: u8,
}

impl Heist {
    pub const LEN: usize = 32 + 1 + 16 + 32 + CREW_COUNT + 8 + HeistStatus::LEN + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum HeistStatus {
    Pending,
    Settled,
    Refunded,
}

impl HeistStatus {
    pub const LEN: usize = 1;
}

#[error_code]
pub enum BankrollError {
    #[msg("Invalid tier")]
    InvalidTier,
    #[msg("Game is paused")]
    GamePaused,
    #[msg("Tier vault does not match heist tier")]
    WrongTierVault,
    #[msg("Invalid heist cost")]
    InvalidHeistCost,
    #[msg("Invalid heist outcome")]
    InvalidOutcome,
    #[msg("Invalid heist status")]
    InvalidHeistStatus,
    #[msg("Invalid payout")]
    InvalidPayout,
    #[msg("Insufficient vault funds")]
    InsufficientVaultFunds,
    #[msg("Invalid crew ID")]
    InvalidCrew,
    #[msg("Crew IDs must be unique")]
    DuplicateCrew,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}

fn assert_valid_heist_cost(tier: u8, heist_cost_lamports: u64) -> Result<()> {
    let tier_index = tier as usize;

    require!(
        heist_cost_lamports >= TIER_MIN_COSTS[tier_index]
            && heist_cost_lamports <= TIER_MAX_COSTS[tier_index],
        BankrollError::InvalidHeistCost
    );

    Ok(())
}

fn assert_valid_payout(tier: u8, heist_cost_lamports: u64, payout_lamports: u64) -> Result<()> {
    let tier_index = tier as usize;
    let max_payout_lamports = heist_cost_lamports
        .checked_mul(TIER_MAX_PAYOUT_MULTIPLIERS_BPS[tier_index])
        .ok_or(BankrollError::ArithmeticOverflow)?
        .checked_div(BASIS_POINTS_DENOMINATOR)
        .ok_or(BankrollError::ArithmeticOverflow)?;

    require!(
        payout_lamports <= max_payout_lamports,
        BankrollError::InvalidPayout
    );

    Ok(())
}

fn assert_valid_crews(crew_ids: &[u8; CREW_COUNT]) -> Result<()> {
    for left in 0..crew_ids.len() {
        require!(crew_ids[left] <= MAX_CREW_ID, BankrollError::InvalidCrew);

        for right in (left + 1)..crew_ids.len() {
            require!(
                crew_ids[left] != crew_ids[right],
                BankrollError::DuplicateCrew
            );
        }
    }

    Ok(())
}

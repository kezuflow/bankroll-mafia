import type { CrewId, HeistTier, OutcomeId } from "@bankroll/shared-types";
import {
  Car,
  Crosshair,
  Eye,
  Gavel,
  KeyRound,
  Laptop,
  Shield,
  Skull,
  UserRoundCheck,
  Vault,
} from "lucide-react";

export const vaultDisplayByTier = {
  street: "100 SOL",
  crew: "500 SOL",
  boss: "2,500 SOL",
  highroller: "10,000 SOL",
} as const satisfies Record<HeistTier, string>;

export const targetDisplay = {
  "corner-bank": {
    id: "corner-bank",
    label: "Corner Bank",
    icon: Crosshair,
    imageSrc: "/images/heist/targets/private-bank.png",
    description:
      "Low bankroll target with stable volume and capped jackpot exposure. Best for testing repeatable heist flow.",
  },
  "credit-union": {
    id: "credit-union",
    label: "Credit Union",
    icon: Shield,
    imageSrc: "/images/heist/targets/private-bank.png",
    description:
      "Lower drama, lower upside target for safer-feeling runs once target profiles are wired.",
  },
  "private-vault": {
    id: "private-vault",
    label: "Private Vault",
    icon: Vault,
    imageSrc: "/images/heist/targets/private-bank.png",
    description:
      "Higher-volatility target placeholder for larger bankroll tiers and stricter caps.",
  },
} as const;

export const crewImageById = {
  driver: "/images/heist/crew/driver.png",
  hacker: "/images/heist/crew/hacker.png",
  insider: "/images/heist/crew/insider.png",
  cleaner: "/images/heist/crew/cleaner.png",
  enforcer: "/images/heist/crew/enforcer.png",
  lockpick: "/images/heist/crew/lockpick.png",
  lookout: "/images/heist/crew/lookout.png",
  lawyer: "/images/heist/crew/lawyer.png",
} satisfies Record<CrewId, string>;

export const crewIcons = {
  driver: Car,
  hacker: Laptop,
  insider: UserRoundCheck,
  cleaner: Shield,
  enforcer: Skull,
  lockpick: KeyRound,
  lookout: Eye,
  lawyer: Gavel,
} satisfies Record<CrewId, typeof Car>;

export const outcomeDescriptions = {
  vault_jackpot: "Capped by vault, entry, and daily tier budget.",
  full_success: "Main payout with normal heist success.",
  partial_success: "Smaller payout after missing the main vault.",
  soft_fail: "Escaped with little value.",
  arrested: "Worst result, but still priced in RTP.",
} as const satisfies Record<OutcomeId, string>;

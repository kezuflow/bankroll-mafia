import { tierConfigs } from "@bankroll/game-config";
import type { CrewId, HeistTier } from "@bankroll/shared-types";
import { create } from "zustand";

interface HeistUiState {
  selectedTierId: HeistTier;
  selectedTargetId: string;
  selectedCrewIds: CrewId[];
  selectedHeistCostBaseUnits: string;
  setSelectedTierId: (tierId: HeistTier) => void;
  setSelectedTargetId: (targetId: string) => void;
  setSelectedCrewIds: (crewIds: CrewId[]) => void;
  toggleCrewId: (crewId: CrewId) => void;
}

export const useHeistUiStore = create<HeistUiState>((set) => ({
  selectedTierId: "street",
  selectedTargetId: "corner-bank",
  selectedCrewIds: ["driver", "hacker", "lockpick", "lookout"],
  selectedHeistCostBaseUnits: tierConfigs
    .find((tier) => tier.id === "street")!
    .maxCostBaseUnits.toString(),
  setSelectedTierId: (selectedTierId) =>
    set({
      selectedTierId,
      selectedHeistCostBaseUnits: tierConfigs
        .find((tier) => tier.id === selectedTierId)!
        .maxCostBaseUnits.toString(),
    }),
  setSelectedTargetId: (selectedTargetId) => set({ selectedTargetId }),
  setSelectedCrewIds: (selectedCrewIds) => set({ selectedCrewIds }),
  toggleCrewId: (crewId) =>
    set((state) => {
      if (state.selectedCrewIds.includes(crewId)) {
        return {
          selectedCrewIds: state.selectedCrewIds.filter((id) => id !== crewId),
        };
      }

      if (state.selectedCrewIds.length >= 4) {
        return state;
      }

      return {
        selectedCrewIds: [...state.selectedCrewIds, crewId],
      };
    }),
}));

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { upsertPrediction } from "@/lib/services/predictionService";
import { canEditPrediction } from "@/lib/services/lockService";

export interface PredictionFormState {
  success: boolean;
  error?: string;
}

export async function submitPrediction(
  _prevState: PredictionFormState,
  formData: FormData
): Promise<PredictionFormState> {
  const user = await requireUser();

  const matchId = formData.get("matchId") as string;
  const homeGoals = parseInt(formData.get("homeGoals") as string, 10);
  const awayGoals = parseInt(formData.get("awayGoals") as string, 10);
  const predictedAdvancingTeamId = (formData.get("predictedAdvancingTeamId") as string) || null;

  if (!matchId || isNaN(homeGoals) || isNaN(awayGoals)) {
    return { success: false, error: "Invalid input" };
  }

  if (homeGoals < 0 || awayGoals < 0 || homeGoals > 20 || awayGoals > 20) {
    return { success: false, error: "Goals must be between 0 and 20" };
  }

  const result = await upsertPrediction({
    userId: user.id,
    matchId,
    homeGoals,
    awayGoals,
    predictedAdvancingTeamId,
    submittedVia: "Web",
  });

  if (result.wasLocked) {
    return { success: false, error: "This match is locked - predictions can no longer be edited" };
  }

  revalidatePath("/predict");
  revalidatePath("/");
  return { success: true };
}

export async function checkCanEdit(matchId: string): Promise<{ allowed: boolean; reason: string }> {
  const user = await requireUser();
  return canEditPrediction(user.id, matchId);
}

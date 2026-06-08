export type UploadPhase = "preparing" | "uploading" | "finalizing" | "done";

export type UploadStatus = {
  phase: UploadPhase;
  label: string;
};

export function uploadLabel(phase: UploadPhase, mediaLabel = "média") {
  switch (phase) {
    case "preparing":
      return `Préparation de l'envoi ${mediaLabel}...`;
    case "uploading":
      return `Envoi ${mediaLabel} en cours...`;
    case "finalizing":
      return "Finalisation de l'envoi...";
    case "done":
      return "Envoi terminé";
  }
}

export async function runWithUploadStatus<T>(
  mediaLabel: string,
  onStatus: (status: UploadStatus | null) => void,
  task: (setPhase: (phase: UploadPhase) => void) => Promise<T>,
): Promise<T> {
  const setPhase = (phase: UploadPhase) => {
    onStatus({ phase, label: uploadLabel(phase, mediaLabel) });
  };

  try {
    setPhase("preparing");
    const result = await task(setPhase);
    setPhase("done");
    onStatus({ phase: "done", label: uploadLabel("done", mediaLabel) });
    await new Promise((resolve) => setTimeout(resolve, 700));
    return result;
  } finally {
    onStatus(null);
  }
}

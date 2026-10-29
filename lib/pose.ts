/**
 * F13: Body Scan — Pose-Adapter.
 *
 * MVP: keine Auto-Erkennung (manuelles Antippen der Punkte). Das Interface ist
 * bewusst schon stabil, damit P1 (On-Device MoveNet o. ä.) nur diese Datei
 * verdrahten muss — der Screen bleibt unverändert.
 */
import type { BodyKeypointId, NormPoint } from './bodyScan';

export interface DetectedKeypoint {
    id: BodyKeypointId;
    point: NormPoint;
    /** 0..1 — Modell-Konfidenz */
    confidence: number;
}

/**
 * Totale Platzhalter-Implementierung: liefert immer null (kein Modell
 * gebündelt). P1 ersetzt den Body durch einen Lazy-Import von
 * @tensorflow/tfjs + pose-detection (MoveNet) und mappt dessen Keypoints auf
 * BodyKeypointId. Lazy-Import ist Pflicht (statischer Web-Export!).
 */
export async function detectPoseLocal(_imageUri: string): Promise<DetectedKeypoint[] | null> {
    return null;
}

/** true, sobald ein Modell verdrahtet ist — steuert den Auto-Hinweis im UI. */
export const POSE_AUTO_AVAILABLE = false;

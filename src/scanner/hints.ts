import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/** Hints tuned for device IMEI labels (mostly linear / Code 128). */
export function createScannerHints(): Map<DecodeHintType, any> {
  const hints = new Map<DecodeHintType, any>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  return hints;
}

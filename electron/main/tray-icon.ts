import { nativeImage, type NativeImage } from "electron";

export function getTrayIconSize(platform: NodeJS.Platform = process.platform): number {
  return platform === "darwin" ? 18 : 24;
}

export function createTrayNativeImage(iconPath: string, platform: NodeJS.Platform = process.platform): NativeImage {
  const image = nativeImage.createFromPath(iconPath);
  return image.resize({
    width: getTrayIconSize(platform),
    height: getTrayIconSize(platform),
    quality: "best",
  });
}

declare module "screenshot-desktop" {
  type ScreenshotOptions = {
    format?: "jpg" | "png";
    screen?: string;
  };

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  export = screenshot;
}

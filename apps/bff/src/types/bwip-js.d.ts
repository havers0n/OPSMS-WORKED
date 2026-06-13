declare module 'bwip-js' {
  type BwipJsOptions = {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    paddingwidth?: number;
    paddingheight?: number;
    backgroundcolor?: string;
  };

  const bwipjs: {
    toBuffer(options: BwipJsOptions): Promise<Buffer>;
  };

  export default bwipjs;
}

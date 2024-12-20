import { PluginCreator } from "postcss";

export interface Options {
  /**
   * Wraps the entire rule inside `@layer` syntax.
   */
  layer?: string;

  /**
   * Where to search for css props, globbing allowed.
   */
  files?: string[];

  /**
   * Selector where the props are pushed to instead of `:root`.
   */
  custom_selector?: string;
}

type Props = Record<string, string | number>;

export type PostcssJitPropsOptions = Options & Props;
declare const postcssJitProps: PluginCreator<PostcssJitPropsOptions>;

export default postcssJitProps;

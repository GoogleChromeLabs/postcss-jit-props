# PostCSS (Just In Time) Props

> A CSS custom property helper based on PostCSS

[![Version](https://img.shields.io/npm/v/postcss-jit-props)](https://github.com/postcss/postcss-jit-props/blob/master/CHANGELOG.md)
[![postcss compatibility](https://img.shields.io/npm/dependency-version/postcss-jit-props/peer/postcss)](https://postcss.org/)
[![Unit Tests](https://github.com/argyleink/postcss-jit-props/actions/workflows/node.js.yml/badge.svg)](https://github.com/argyleink/postcss-jit-props/actions/workflows/node.js.yml)

`postcss-jit-props` watches for CSS variables and ensures a value entry exists in the stylesheet. Only ship used variables!   

**Provide variables as Javascript or JSON or CSS.**

[PostCSS]: https://github.com/postcss/postcss

CSS Before:  
```css
.foo {
  color: var(--red);
  padding: var(--size-1) var(--size-2);
  animation: var(--fade-in);
}

@media (--dark) {
  .foo {
    color: white;
  }
}
```

CSS After:  
```diff
+ @custom-media --dark (prefers-color-scheme: dark);

+ :root {
+   --red: #f00;
+   --size-1: 1rem;
+   --size-2: 2rem;
+   --fade-in: fade-in .5s ease;
+ }

.foo {
  color: var(--red);
  padding: var(--size-1) var(--size-2);
  animation: var(--fade-in);
}

@media (--dark) {
  .foo {
    color: white;
  }
}

+ @keyframes fade-in {
+   to { opacity: 1; }
+ }
```

## Usage

**Step 1:** Install plugin:

```sh
npm install --save-dev postcss postcss-jit-props
```

**Step 2:** Check you project for existed PostCSS config: `postcss.config.js`
in the project root, `"postcss"` section in `package.json`
or `postcss` in bundle config.

If you do not use PostCSS, add it according to [official docs]
and set this plugin in settings.

**Step 3:** Add the plugin to plugins list and call it with your props.

```js
module.exports = {
  plugins: [
    require('postcss-jit-props')({
      '--red': '#f00',
      '--pink': '#ffc0cb',
      '--size-1': '1rem',
      '--size-2': '2rem',
      '--fade-in': 'fade-in .5s ease',
      '--fade-in-@': '@keyframes fade-in {to { opacity: 1 }}',
      '--dark': '@custom-media --dark (prefers-color-scheme: dark);',
    }),
    require('autoprefixer')
  ]
}
```

or  

```js
module.exports = {
  plugins: [
    require('postcss-jit-props')([files: ['./props.css']]),
    require('autoprefixer')
  ]
}
```

Javascript objects passed in have the advantage of just-in-time inject of `@keyframes` and `@custom-media`

[official docs]: https://github.com/postcss/postcss#usage

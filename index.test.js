/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const postcss = require('postcss')
const plugin = require('./')

const MockProps = {
  '--red': '#f00',
  '--pink': '#ffc0cb',
  '--h': 200,
  '--s': '50%',
  '--l': '50%',
  '--size-1': '1rem',
  '--size-2': '2rem',
  '--fade-in': 'fade-in .5s ease',
  '--fade-in-@': '@keyframes fade-in {to { opacity: 1 }}',
  '--adaptive-fade': 'adaptive-fade .5s ease',
  '--adaptive-fade-@': '@keyframes adaptive-fade {to { background: white }}',
  '--adaptive-fade-@media:dark': '@keyframes adaptive-fade {to { background: black }}',
  '--dark': '@custom-media --dark (prefers-color-scheme: dark);',
  '--text': 'white',
  '--text-@media:dark': 'black',
}

const MockPropsWithCustomAdaptiveProp = {
  '--text': 'white',
  '--text-dark': 'black',
}

async function run (input, output, options = { }) {
  let result = await postcss([plugin(options)]).process(input, { from: 'input.css', to: 'output.css', map: { inline: false } })
  expect(result.css.replace('\n/*# sourceMappingURL=output.css.map */', '')).toEqual(output)
  expect(result.warnings()).toHaveLength(0)

  if (options.files?.length) {
    expect(result.messages.filter(x => x.type === 'dependency')).toHaveLength(options.files?.length)
  }

  const map = result.map.toJSON()
  expect(map.sources).toEqual(['input.css'])
}

it('Can jit a single prop', async () => {
  await run(
`a {
  color: var(--red);
}`, 
`:root {
  --red: #f00;
}
a {
  color: var(--red);
}`, 
  MockProps
  )
})

it('Can jit a single prop with spaces', async () => {
  await run(
`a {
  color: var( --red );
}`,
`:root {
  --red: #f00;
}
a {
  color: var( --red );
}`,
  MockProps
  )
})

it('Can jit a single prop that has fallbacks', async () => {
  await run(
`a {
  color: var(--red, hotpink);
}`, 
`:root {
  --red: #f00;
}
a {
  color: var(--red, hotpink);
}`, 
  MockProps
  )
})

it('Can jit a single prop with spaces that has fallbacks', async () => {
  await run(
`a {
  color: var(  --red, hotpink);
}`,
`:root {
  --red: #f00;
}
a {
  color: var(  --red, hotpink);
}`,
  MockProps
  )
})

it('Can jit a single prop that has fallbacks and nested props', async () => {
  await run(
`a {
  color: var(--red, var(--pink), hotpink);
}`, 
`:root {
  --red: #f00;
  --pink: #ffc0cb;
}
a {
  color: var(--red, var(--pink), hotpink);
}`, 
  MockProps
  )
})

it('Can jit a single, undefined prop that has fallbacks and nested props', async () => {
  await run(
`a {
  color: var(--orange, var(--pink), hotpink);
}`, 
`:root {
  --pink: #ffc0cb;
}
a {
  color: var(--orange, var(--pink), hotpink);
}`, 
  MockProps
  )
})


it('Can jit a single prop with spaces that has fallbacks and nested props', async () => {
  await run(
`a {
  color: var( --red, var( --pink ), hotpink);
}`,
`:root {
  --red: #f00;
  --pink: #ffc0cb;
}
a {
  color: var( --red, var( --pink ), hotpink);
}`,
  MockProps
  )
})

it('Can jit multiple props', async () => {
  await run(
`a {
  color: var(--red);
  border-color: var(--pink);
  padding-block-start: var( --size-1 );
}`, 
`:root {
  --red: #f00;
  --pink: #ffc0cb;
  --size-1: 1rem;
}
a {
  color: var(--red);
  border-color: var(--pink);
  padding-block-start: var( --size-1 );
}`, 
  MockProps
  )
})

it('Can jit multiple props from shorthand', async () => {
  await run(
`a {
  padding-block: var(--size-1) var( --size-2  );
}`, 
`:root {
  --size-1: 1rem;
  --size-2: 2rem;
}
a {
  padding-block: var(--size-1) var( --size-2  );
}`, 
  MockProps
  )
})

it('Can jit props from inside functions', async () => {
  await run(
`a {
  color: hsl(var(--h) var(--s) var( --l ));
}`, 
`:root {
  --h: 200;
  --s: 50%;
  --l: 50%;
}
a {
  color: hsl(var(--h) var(--s) var( --l ));
}`, 
  MockProps
  )
})

it('Only adds a prop one time to :root', async () => {
  await run(
`a {
  color: var(--red);
  border-color: var(--red );
}`, 
`:root {
  --red: #f00;
}
a {
  color: var(--red);
  border-color: var(--red );
}`, 
  MockProps
  )
})

it('Can jit props into a layer', async () => {
  await run(
`a {
  color: hsl(var(--h) var(--s) var( --l ));
}`, 
`@layer test {
  :root {
    --h: 200;
    --s: 50%;
    --l: 50%;
  }
}
a {
  color: hsl(var(--h) var(--s) var( --l ));
}`, 
  {
    ... MockProps,
    layer: 'test',
  }
  )
})

it('Can jit a keyframe animation', async () => {
  await run(
`a {
  animation: var(--fade-in);
}`, 
`:root {
  --fade-in: fade-in .5s ease;
}a {
  animation: var(--fade-in);
}@keyframes fade-in {to { opacity: 1 }}`, 
  MockProps
  )
})

it('Can jit an adaptive keyframe animation', async () => {
  await run(
`a {
  animation: var(--adaptive-fade);
}`, 
`:root {
  --adaptive-fade: adaptive-fade .5s ease;
}a {
  animation: var(--adaptive-fade);
}@keyframes adaptive-fade {to { background: white }}@media (prefers-color-scheme: dark) {:root {}@keyframes adaptive-fade {to { background: black }}
}`, 
  MockProps
  )
})

it('Can jit @custom-media', async () => {
  await run(
`@media (--dark) {
  a {
    color: white;
  }
}`, 
`@custom-media --dark (prefers-color-scheme: dark);
:root{}
@media (--dark) {
  a {
    color: white;
  }
}`, 
  MockProps
  )
})

it('Can jit @custom-media with spaces', async () => {
  await run(
`@media ( --dark ) {
  a {
    color: white;
  }
}`,
`@custom-media --dark (prefers-color-scheme: dark);
:root{}
@media ( --dark ) {
  a {
    color: white;
  }
}`,
  MockProps
  )
})

it('Can jit props from JSON', async () => {
  await run(
`a {
  color: var(--red);
  border-color: var( --pink  );
}`,
`:root {
  --red: #f00;
  --pink: #ffc0cb;
}
a {
  color: var(--red);
  border-color: var( --pink  );
}`,
  MockProps
  )
})

it('Can jit props from a CSS file', async () => {
  await run(
`@media (--dark) {
  a {
    color: var(--red);
    border-color: var( --pink );
    animation: var(--fade-in);
  }
}`, 
`@custom-media --dark (prefers-color-scheme: dark);
:root{
  --red: #f00;
  --pink: #ffc0cb;
  --fade-in: fade-in .5s ease;
}
@media (--dark) {
  a {
    color: var(--red);
    border-color: var( --pink );
    animation: var(--fade-in);
  }
}
@keyframes fade-in {to { opacity: 1 }}`, 
  { files: ['./props.test.css']}
  )
})

it('Can jit props from a CSS file via glob', async () => {
  await run(
`@media (--dark) {
  a {
    color: var(--red);
    border-color: var( --pink );
    animation: var(--fade-in);
  }
}`, 
`@custom-media --dark (prefers-color-scheme: dark);
:root{
  --red: #f00;
  --pink: #ffc0cb;
  --fade-in: fade-in .5s ease;
}
@media (--dark) {
  a {
    color: var(--red);
    border-color: var( --pink );
    animation: var(--fade-in);
  }
}
@keyframes fade-in {to { opacity: 1 }}`, 
  { files: ['./*.test.css']}
  )
})

it('Can fail without srcProps options gracefully', async () => {
  console.warn = jest.fn()
  await postcss([plugin({})]).process(``, { from: undefined })

  expect(console.warn).toHaveBeenCalledWith('postcss-jit-props: Variable source(s) not passed.')
})

it('Can jit props to a custom selector', async () => {
  await run(
`a {
  color: var(--red);
}`, 
`:global {
  --red: #f00;
}
a {
  color: var(--red);
}`, 
  {
    ... MockProps,
    custom_selector: ':global',
  }
  )
})

it('Wont create a :root {} context unless props are found', async () => {
  await run(
`a {
  color: red;
}`, 
`a {
  color: red;
}`, 
  {
    ... MockProps
  }
  )
})

it('Can jit a light and dark adaptive prop', async () => {
  await run(
`p {
  color: var(--text);
}`, 
`:root {
  --text: white;
}
p {
  color: var(--text);
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: black;
  }
}`, 
  MockProps
  )
})

it('Can jit a light and dark color with a custom adaptive prop parameter', async () => {
  await run(
`p {
  color: var(--text);
}`,
`:root {
  --text: white;
}
p {
  color: var(--text);
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: black;
  }
}`,
  {
  ...MockPropsWithCustomAdaptiveProp,
  adaptive_prop_selector: '-dark'
  }
  )
})

it('Supports parallel runners', async () => {
  const pluginInstance = plugin({
    '--red': '#f00',
    '--pink': '#ffc0cb',
  });

  let [resultA, resultB, resultC, resultD] = await Promise.all([
    postcss([pluginInstance]).process(`a { color: var(--red); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--pink); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--red); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--pink); }`, { from: undefined }),
  ])

  let resultE = await postcss([pluginInstance]).process(`a { color: green; }`, { from: undefined })

  expect(resultA.css).toEqual(':root { --red: #f00; }\na { color: var(--red); }')
  expect(resultA.warnings()).toHaveLength(0)

  expect(resultB.css).toEqual(':root { --pink: #ffc0cb; }\na { color: var(--pink); }')
  expect(resultB.warnings()).toHaveLength(0)

  expect(resultC.css).toEqual(':root { --red: #f00; }\na { color: var(--red); }')
  expect(resultC.warnings()).toHaveLength(0)

  expect(resultD.css).toEqual(':root { --pink: #ffc0cb; }\na { color: var(--pink); }')
  expect(resultD.warnings()).toHaveLength(0)

  expect(resultE.css).toEqual('a { color: green; }')
  expect(resultE.warnings()).toHaveLength(0)
})

it('Supports parallel runners when reading from a file', async () => {
  const pluginInstance = plugin({ files: ['./props.test.css'] });

  let [resultA, resultB, resultC, resultD] = await Promise.all([
    postcss([pluginInstance]).process(`a { color: var(--red); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--pink); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--red); }`, { from: undefined }),
    postcss([pluginInstance]).process(`a { color: var(--pink); }`, { from: undefined }),
  ])

  let resultE = await postcss([pluginInstance]).process(`a { color: green; }`, { from: undefined })

  expect(resultA.css).toEqual(':root { --red: #f00; }\na { color: var(--red); }')
  expect(resultA.warnings()).toHaveLength(0)

  expect(resultB.css).toEqual(':root { --pink: #ffc0cb; }\na { color: var(--pink); }')
  expect(resultB.warnings()).toHaveLength(0)

  expect(resultC.css).toEqual(':root { --red: #f00; }\na { color: var(--red); }')
  expect(resultC.warnings()).toHaveLength(0)

  expect(resultD.css).toEqual(':root { --pink: #ffc0cb; }\na { color: var(--pink); }')
  expect(resultD.warnings()).toHaveLength(0)

  expect(resultE.css).toEqual('a { color: green; }')
  expect(resultE.warnings()).toHaveLength(0)
})

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
const fs      = require('fs');

const processed = Symbol('processed')

module.exports = (UserProps) => {
  const STATE = {
    target_rule: null,  // :root for props
    target_ss: null,    // stylesheet for keyframes/MQs
    mapped: null        // track prepended props
  }

  return {
    postcssPlugin: 'postcss-jit-props',

    async Once (node, {Rule}) {
      let target_selector = ':root'

      if (!Object.keys(UserProps).length) {
        return console.warn('postcss-jit-props: Variable source(s) not passed.')
      }

      if (UserProps?.files?.length) {
        await Promise.all(UserProps.files.map(async file => {
          let data = fs.readFileSync(file, 'utf8')
          let result = await postcss([(function(){})]).process(data, { from: undefined })

          result.root.walkDecls(decl => {
            if (!decl.prop.includes('--')) return
            UserProps[decl.prop] = decl.value
          })

          result.root.walkAtRules(atrule => {
            if (atrule.name === 'custom-media') {
              let media = atrule.params.slice(0, atrule.params.indexOf(' '))
              UserProps[media] = `@custom-media ${atrule.params};`
            }
            else if (atrule.name === 'keyframes') {
              let keyframeName = `--${atrule.params}-@`
              let keyframes = atrule.source.input.css.slice(atrule.source.start.offset, atrule.source.end.offset+1)
              UserProps[keyframeName] = keyframes
            }
          })
        }))
      }

      if (UserProps?.custom_selector) {
        target_selector = UserProps.custom_selector
      }

      STATE.mapped = new Set()
      STATE.target_rule = new Rule({ selector: target_selector })
      STATE.target_ss = node.root()

      node.root().prepend(STATE.target_rule)
    },

    AtRule (atrule) {
      // bail early if possible
      if (atrule.name !== 'media' || atrule[processed]) return

      // extract prop from atrule params
      let prop = atrule.params.replace(/[( )]+/g, '');

      // bail if media prop already prepended
      if (STATE.mapped.has(prop)) return

      // lookup prop value from pool
      let value = UserProps[prop] || null

      // warn if media prop not resolved
      if (!value) {
        return
      }

      // prepend the custom media
      STATE.target_ss.prepend(value)

      // track work to prevent duplication
      atrule[processed] = true
      STATE.mapped.add(prop)
    },

    Declaration (node, {Declaration}) {
      // bail early
      if (node[processed]) return

      let matches = node.value.match(/var\(\s*(--[\w\d-_]+)/g);

      if (!matches) return;

      let props = matches.map(v => v.replace('var(', '').trim())

      for (let prop of props) {
        // bail prepending this prop if it's already been done
        if (STATE.mapped.has(prop)) continue

        // lookup prop from options object
        let value = UserProps[prop] || null

        // warn if props won't resolve from plugin
        if (!value) {
          return
        }

        // create and append prop to :root
        let decl = new Declaration({ prop, value })
        STATE.target_rule.append(decl)

        // lookup keyframes for the prop and append if found
        let keyframes = UserProps[`${prop}-@`]
        keyframes && STATE.target_ss.append(keyframes)

        // track work to prevent duplicative processing
        node[processed] = true
        STATE.mapped.add(prop)
      }
    }
  }
}

module.exports.postcss = true

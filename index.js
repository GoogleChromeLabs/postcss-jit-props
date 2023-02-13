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
const glob = require('tiny-glob/sync');
const crypto = require('crypto');

const processed = Symbol('processed')

const getAdaptivePropSelector = (userProps) => {
  return (prop) => {
    if (!userProps || !userProps.adaptive_prop_selector) {
      return `${prop}-@media:dark`
    }

    return `${prop}${userProps.adaptive_prop_selector}`
  }
}

module.exports = (UserProps) => {
  const FilePropsCache = new Map();

  return {
    postcssPlugin: 'postcss-jit-props',
    prepare() {
      const UserPropsCopy = JSON.parse(JSON.stringify(UserProps));

      const STATE = {
        mapped: null,            // track prepended props
        mapped_dark: null,       // track dark mode prepended props

        target_layer: null,       // layer for props
        target_rule: null,       // :root for props
        target_rule_dark: null,  // :root for dark props
        target_ss: null,         // stylesheet for keyframes/MQs
        target_media_dark: null, // dark media query props
      }

      const adaptivePropSelector = getAdaptivePropSelector(UserProps)

      return {
        async Once(node, { result, Rule, AtRule }) {
          let target_selector = ':root'

          if (!Object.keys(UserPropsCopy).length) {
            return console.warn('postcss-jit-props: Variable source(s) not passed.')
          }

          if (UserPropsCopy?.files?.length) {

            const files = UserPropsCopy?.files
              .map((file) => glob(file))
              .reduce((flattenedFileList, files) => flattenedFileList.concat(files), [])

            await Promise.all(files.map(async file => {
              result.messages.push({
                type: 'dependency',
                plugin: 'postcss-jit-props',
                file: file,
                parent: node.source?.input?.file,
              });

              let data = fs.readFileSync(file, 'utf8')

              const hashSum = crypto.createHash('sha256')
              hashSum.update(file)
              hashSum.update(data)
              const fileCacheKey = hashSum.digest('hex')

              if (FilePropsCache.has(fileCacheKey)) {
                const fileProps = FilePropsCache.get(fileCacheKey)
                for (const [key, value] of fileProps) {
                  UserPropsCopy[key] = value
                }

                return
              }
              
              const fileProps = new Map()
              FilePropsCache.set(fileCacheKey, fileProps)
              
              let dependencyResult = postcss.parse(data, { from: file })

              dependencyResult.walkDecls(decl => {
                if (!decl.variable) return
                UserPropsCopy[decl.prop] = decl.value
                fileProps.set(decl.prop, decl.value)
              })

              dependencyResult.walkAtRules(atrule => {
                if (atrule.name === 'custom-media') {
                  let media = atrule.params.slice(0, atrule.params.indexOf(' '))
                  UserPropsCopy[media] = `@custom-media ${atrule.params};`
                  fileProps.set(media, `@custom-media ${atrule.params};`)
                }
                else if (atrule.name === 'keyframes') {
                  let keyframeName = `--${atrule.params}-@`
                  let keyframes = atrule.source.input.css.slice(atrule.source.start.offset, atrule.source.end.offset + 1)
                  UserPropsCopy[keyframeName] = keyframes
                  fileProps.set(keyframeName, keyframes)
                }
              })
            }))
          }

          if (UserPropsCopy?.custom_selector) {
            target_selector = UserPropsCopy.custom_selector
          }

          STATE.mapped = new Set()
          STATE.mapped_dark = new Set()

          STATE.target_rule = new Rule({ selector: target_selector })
          STATE.target_rule_dark = new Rule({ selector: target_selector })
          STATE.target_media_dark = new AtRule({ name: 'media', params: '(prefers-color-scheme: dark)' })

          if (UserPropsCopy?.layer) {
            STATE.target_layer = new AtRule({ name: 'layer', params: UserPropsCopy.layer })
            node.root().prepend(STATE.target_layer)
            STATE.target_ss = STATE.target_layer
          }
          else
            STATE.target_ss = node.root()
        },

        AtRule(atrule) {
          // bail early if possible
          if (atrule.name !== 'media' || atrule[processed]) return

          // extract prop from atrule params
          let prop = atrule.params.replace(/[( )]+/g, '');

          // bail if media prop already prepended
          if (STATE.mapped.has(prop)) return

          // create :root {} context just in time
          if (STATE.mapped.size === 0)
            STATE.target_ss.prepend(STATE.target_rule)

          // lookup prop value from pool
          let value = UserPropsCopy[prop] || null

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

        Declaration(node, { Declaration }) {
          // bail early
          if (node[processed] || !node.value) return
          // console.log(node)
          let matches = node.value.match(/var\(\s*(--[\w\d-_]+)/g)

          if (!matches) return

          // create :root {} context just in time
          if (STATE.mapped.size === 0)
            STATE.target_ss.prepend(STATE.target_rule)

          let props = matches.map(v => v.replace('var(', '').trim())

          for (let prop of props) {
            // bail prepending this prop if it's already been done
            if (STATE.mapped.has(prop)) continue

            // lookup prop from options object
            let value = UserPropsCopy[prop] || null

            // warn if props won't resolve from plugin
            if (!value) {
              continue
            }

            // create and append prop to :root
            let decl = new Declaration({ prop, value })
            STATE.target_rule.append(decl)
            STATE.mapped.add(prop)

            // lookup keyframes for the prop and append if found
            let keyframes = UserPropsCopy[`${prop}-@`]
            keyframes && STATE.target_ss.append(keyframes)

            // lookup dark adaptive prop and append if found
            let adaptive = UserPropsCopy[adaptivePropSelector(prop)]
            if (adaptive && !STATE.mapped_dark.has(prop)) {
              // create @media ... { :root {} } context just in time
              if (STATE.mapped_dark.size === 0) {
                STATE.target_media_dark.append(STATE.target_rule_dark)
                STATE.target_ss.append(STATE.target_media_dark)
              }

              if (adaptive.includes('@keyframes')) {
                STATE.target_media_dark.append(adaptive)
              }
              else {
                // append adaptive prop definition to dark media query
                let darkdecl = new Declaration({ prop, value: adaptive })
                STATE.target_rule_dark.append(darkdecl)
                STATE.mapped_dark.add(prop)
              }
            }

            // track work to prevent duplicative processing
            node[processed] = true
          }
        }
      }
    }
  }
}

module.exports.postcss = true

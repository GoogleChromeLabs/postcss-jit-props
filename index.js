const postcss = require('postcss')
const fs      = require('fs');

const processed = Symbol('processed')

module.exports = (opts) => {
  const STATE = {
    target_rule: null,  // :root for props
    target_ss: null,    // stylesheet for keyframes/MQs
    mapped: null        // track prepended props
  }

  return {
    postcssPlugin: 'postcss-jit-props',

    async Once (node, {Rule}) {
      if (!Object.keys(opts).length) {
        return console.warn('postcss-jit-props: Variable source(s) not passed.')
      }

      if (opts?.files?.length) {
        await Promise.all(opts.files.map(async file => {
          let data = fs.readFileSync(file, 'utf8')
          let result = await postcss([(function(){})]).process(data, { from: undefined })

          result.root.walkDecls(decl => {
            if (!decl.prop.includes('--')) return
            opts[decl.prop] = decl.value
          })

          result.root.walkAtRules(atrule => {
            if (atrule.name === 'custom-media') {
              let media = atrule.params.slice(0, atrule.params.indexOf(' '))
              opts[media] = `@custom-media ${atrule.params};`
            }
            else if (atrule.name === 'keyframes') {
              let keyframeName = `--${atrule.params}-@`
              let keyframes = atrule.source.input.css.slice(atrule.source.start.offset, atrule.source.end.offset+1)
              opts[keyframeName] = keyframes
            }
          })
        }))
      }

      STATE.mapped = new Set()
      STATE.target_rule = new Rule({ selector: ':root' })
      STATE.target_ss = node.root()

      node.root().prepend(STATE.target_rule)
    },

    AtRule (atrule) {
      // bail early if possible
      if (atrule.name !== 'media' || atrule[processed]) return

      // extract prop from atrule params
      let prop = atrule.params.slice(1).slice(0,-1)

      // bail if media prop already prepended
      if (STATE.mapped.has(prop)) return

      // lookup prop value from pool
      let value = opts[prop] || null

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
      if (!node.value.includes('var(--') || node[processed]) return
      
      let props = node.value
        .split(' ')
        .filter(v => v.includes('var(--'))
        .map(v => {
          let beginning = v.slice(v.indexOf('var(--') + 4)
          return beginning.slice(0, beginning.indexOf(')'))
        })

      for (let prop of props) {
        // bail prepending this prop if it's already been done
        if (STATE.mapped.has(prop)) continue

        // lookup prop from options object
        let value = opts[prop] || null

        // warn if props won't resolve from plugin
        if (!value) {
          return
        }

        // create and append prop to :root
        let decl = new Declaration({ prop, value })
        STATE.target_rule.append(decl)

        // lookup keyframes for the prop and append if found
        let keyframes = opts[`${prop}-@`]
        keyframes && STATE.target_ss.append(keyframes)

        // track work to prevent duplicative processing
        node[processed] = true
        STATE.mapped.add(prop)
      }
    }
  }
}

module.exports.postcss = true

// Extract literal fixture arrays from a dashboard snapshot without executing JSX.
const parser = require('../../Frontend/node_modules/@babel/parser')

const wanted = new Set([
  'branches', 'services', 'staffList', 'patients', 'branchServices',
  'doctorSchedules', 'appointments', 'bookings', 'diseases', 'medicines',
  'visitRecords', 'prescriptionDetails', 'labDetails', 'labTestDetails',
  'treatmentSchedules', 'labTechnicians', 'completedFinancialRecords',
  'treatmentRevenueDetails', 'bhytCategories',
])
const wantedObjects = new Set(['initialPatientProfile', 'slotDrafts'])

function literal(node) {
  if (!node) throw new Error('empty')
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') {
    return node.value
  }
  if (node.type === 'NullLiteral') return null
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral') {
    return -node.argument.value
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((part) => part.value.cooked).join('')
  }
  if (node.type === 'ArrayExpression') return node.elements.map(literal)
  if (node.type === 'ObjectExpression') {
    const result = {}
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty' || property.computed) throw new Error('dynamic object')
      const key = property.key.name || property.key.value
      result[key] = literal(property.value)
    }
    return result
  }
  throw new Error(`dynamic ${node.type}`)
}

function fixtures(source) {
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] })
  const results = []
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VariableDeclarator') {
      let name = node.id?.name
      if (node.id?.type === 'ArrayPattern') name = node.id.elements[0]?.name
      let array = node.init
      if (array?.type === 'CallExpression' && array.callee?.name === 'useState') {
        array = array.arguments[0]
      }
      if (wanted.has(name) && array?.type === 'ArrayExpression') {
        array.elements.forEach((element, index) => {
          try { results.push({ variable: name, index, value: literal(element) }) }
          catch (_error) {
            results.push({ variable: name, index, value: { _raw_js: source.slice(element.start, element.end) } })
          }
        })
      }
      if (wantedObjects.has(name) && node.init) {
        try { results.push({ variable: name, index: 0, value: literal(node.init) }) }
        catch (_error) {
          results.push({ variable: name, index: 0, value: { _raw_js: source.slice(node.init.start, node.init.end) } })
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(ast.program)
  return results
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try { process.stdout.write(JSON.stringify(fixtures(input))) }
  catch (error) { process.stderr.write(error.message); process.exitCode = 1 }
})

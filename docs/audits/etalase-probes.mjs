/**
 * Audit characterization probes — NOT acceptance tests for desired behavior.
 * HISTORICAL ONLY: function shapes and assertions describe the pre-fix baseline.
 * Use tests/showcase-*.test.ts(x) for current regressions.
 * Run on the original baseline only: node docs/audits/etalase-probes.mjs --historical
 * Extracts actual function bodies via TypeScript AST, then injects small mocks.
 * No backend, React renderer, or device is exercised. A failed assertion after
 * a fix is expected: convert the scenario into a proper regression test.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

if (!process.argv.includes('--historical')) {
  console.log('Historical defect probes disabled. Run npm test and npm run test:components for current regressions.')
  process.exit(0)
}

const root = fileURLToPath(new URL('../../', import.meta.url))
function extract(file, name) {
  const text = readFileSync(resolve(root, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(source)
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      const init = node.initializer
      const expression = ts.isCallExpression(init) && init.expression.getText(source) === 'useCallback'
        ? init.arguments[0] : init
      found = `const ${name} = ${expression.getText(source)}`
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found, `Missing source function: ${name}`)
  return ts.transpileModule(found, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
function load(file, names, mocks) {
  return vm.runInNewContext(names.map(name => extract(file, name)).join('\n') +
    `\n({${names.join(',')}})`, mocks)
}
const detail = 'app/showcase/[id].tsx'
const management = 'app/showcase-management.tsx'
const quiet = { show() {} }
let passed = 0
async function probe(name, run) {
  await run()
  console.log(`CONFIRMED (isolated): ${name}`)
  passed++
}

await probe('E01: delete one comment clears unrelated roots and replies', async () => {
  let comments = [{ id: 'a', replies: [{ id: 'a1' }] }, { id: 'b', replies: [] }]
  const funcs = load(detail, ['patchComment', 'handleConfirmAction'], {
    setComments: update => { comments = update(comments) },
    confirmTarget: { id: 'a1' }, confirmKind: 'delete',
    deleteShowcaseComment: async id => assert.equal(id, 'a1'),
    setConfirmBusy() {}, setCommentTotal() {}, setConfirmTarget() {}, toast: quiet,
  })
  await funcs.handleConfirmAction()
  assert.equal(comments.length, 0)
})

await probe('E33: cleared optional fields disappear from serialized update', () => {
  const { formToPayload } = load(management, ['formToPayload'], {})
  const payload = JSON.parse(JSON.stringify(formToPayload({
    description: '', category: '', priceMin: 0, priceMax: 0, isPublic: true,
  })))
  assert.deepEqual(payload, { visibility: 'PUBLIC' })
})

await probe('E46: reorder submits removed image ID from obsolete draft', async () => {
  let submitted
  const { closeImagesSheet } = load(management, ['closeImagesSheet'], {
    imagesItemId: 'item', imagesItem: { images: [{ id: 'a' }, { id: 'b' }] },
    orderDraft: ['c', 'b', 'a'], committingOrder: false,
    setImagesItemId() {}, setOrderDraft() {}, setCommittingOrder() {},
    api: { users: { reorderShowcaseImages: async (_, ids) => { submitted = [...ids] } } },
    touchFeed() {}, query: { refresh: async () => {} }, toast: quiet,
  })
  await closeImagesSheet()
  assert.deepEqual(submitted, ['c', 'b', 'a'])
})

await probe('E21: delayed comment response writes into newly opened sheet', async () => {
  let resolveRequest
  const response = new Promise(resolve => { resolveRequest = resolve })
  let comments = []
  let draft = 'comment for A'
  const { handleSend } = load('components/ui/showcase-comments-sheet.tsx', ['handleSend'], {
    showcaseId: 'A', draft, sending: false,
    setSending() {}, addShowcaseComment: () => response,
    setLocalComments: update => { comments = update(comments) },
    setDraft: value => { draft = value }, onCommentAdded() {}, toast: quiet,
  })
  const pending = handleSend()
  // The component stays mounted; its item-change effect has now reset A.
  comments = []
  draft = 'new draft for B'
  resolveRequest({ id: 'a-comment', showcaseId: 'A', content: 'comment for A' })
  await pending
  assert.equal(comments[0].showcaseId, 'A')
  assert.equal(draft, '')
})

await probe('E38: multi-image legacy upload hides only the LAST auto-created item', async () => {
  const hidden = []
  let calls = 0
  const { handleUpload } = load(management, ['handleUpload', 'rawMeta'], {
    SHOWCASE_MAX_IMAGES: 8,
    pickImages: async () => ({ status: 'picked', assets: [{ name: 'a' }, { name: 'b' }] }),
    uploadShowcasePhoto: async () => ({ kind: 'item', itemId: `item-${++calls}` }),
    api: { users: { updateShowcase: async id => { hidden.push(id) } } },
    setUploading() {}, setForm() {}, setFormError() {}, setEditor() {},
    EMPTY_FORM: {}, query: { refresh: async () => {} }, touchFeed() {},
    cleanupPendingShowcaseKeys: async () => {}, toast: quiet,
  })
  await handleUpload()
  assert.equal(calls, 2)
  assert.deepEqual(hidden, ['item-2'])
})

await probe('E23: Enter invokes duplicate comment POST while first POST is pending', async () => {
  let posts = 0
  const { handleSendComment } = load(detail, ['handleSendComment'], {
    draft: 'hello', id: 'item', replyTo: null,
    setSendingComment() {}, setDraft() {}, setReplyTo() {}, insertLocalComment() {},
    addShowcaseComment: async () => { posts++; return { id: `c-${posts}` } }, toast: quiet,
  })
  await Promise.all([handleSendComment(), handleSendComment()])
  assert.equal(posts, 2)
})
console.log(`${passed}/6 audit characterization probes confirmed. These are defect reproductions, not a green release gate.`)

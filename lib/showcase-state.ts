/** Domain invariants shared by the Etalase screens and regression tests. */
import type { ShowcaseComment, ShowcaseCommentWithReplies } from "@/lib/api/showcase"

export function mergeComments(previous: ShowcaseCommentWithReplies[], incoming: ShowcaseCommentWithReplies[]) {
  const byId = new Map(previous.map((comment) => [comment.id, comment]))
  for (const comment of incoming) {
    const old = byId.get(comment.id)
    const replies = new Map((old?.replies ?? []).map((reply) => [reply.id, reply]))
    for (const reply of comment.replies ?? []) replies.set(reply.id, reply)
    byId.set(comment.id, { ...old, ...comment, replies: [...replies.values()] })
  }
  return [...byId.values()]
}

export function patchComments(
  comments: ShowcaseCommentWithReplies[],
  patch: (comment: ShowcaseComment) => ShowcaseComment | null,
): ShowcaseCommentWithReplies[] {
  return comments.flatMap((root) => {
    const next = patch(root)
    const replies = (root.replies ?? []).flatMap((reply) => {
      const updated = patch(reply)
      return updated ? [updated] : []
    })
    // A deleted root cannot remain actionable. Fetch the canonical thread after delete.
    return next ? [{ ...next, replies }] : []
  })
}

export function validImageOrder(draft: string[] | null, server: string[]): boolean {
  return !!draft && new Set(draft).size === draft.length && draft.length === server.length &&
    server.every((id) => draft.includes(id))
}

export function showcaseIsHidden(item: { isActive?: boolean; visibility?: string | null }) {
  return item.isActive === false || item.visibility === "PRIVATE"
}

/** Shared lock: multiple mounted cards must not mutate the same item concurrently. */
const mutations = new Set<string>()
export function acquireShowcaseMutation(key: string): (() => void) | null {
  if (mutations.has(key)) return null
  mutations.add(key)
  return () => { mutations.delete(key) }
}

export function showcaseMutationPending(key: string): boolean { return mutations.has(key) }

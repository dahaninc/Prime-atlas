import { redirect } from "next/navigation";

/**
 * /underpriced — merged into Deal Board's "All Markets" view mode
 * (2026-07-09 surface consolidation; see the six-surface audit). Both
 * surfaces ran the identical screenByZipComps engine over the identical
 * pool — Deal Board now owns the merged view, with Underpriced's
 * search/filter/sort/multi-select/brochure export folded in unchanged
 * (src/components/deal-board/AllMarketsExplorer.tsx).
 *
 * A redirect (not a 410/removal) so existing bookmarks, marketing links,
 * and deal-alert emails pointing at /underpriced keep working — ?view=all
 * makes it a deep link into the right mode, not just a bounce to the
 * market-by-market default.
 */
export default function UnderpricedRedirect() {
  redirect("/deal-board?view=all");
}

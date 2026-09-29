import type { FeedItem, UserFeed } from '@justcampus/shared'
import { isNewFeedItem } from '@/lib/feed'

/**
 * The entries of `feed` to notify about: unread ones (published after the user's last read) that
 * were not in the previous copy seen, `previousIds`. The first copy seen (`undefined`) notifies
 * nothing, so opening the app does not announce what was already there.
 */
export function newFeedEntries(
  previousIds: ReadonlySet<string> | undefined,
  feed: Pick<UserFeed, 'readAt' | 'items'>
): FeedItem[] {
  if (!previousIds) return []
  return feed.items.filter((item) => !previousIds.has(item.id) && isNewFeedItem(item, feed.readAt))
}

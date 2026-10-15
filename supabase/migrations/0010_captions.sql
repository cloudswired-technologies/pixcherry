-- Captions replace comments: the person who shared a photo can add a line to
-- it, and it travels with the photo (written on single downloads, captions.txt
-- in the album ZIP). Comments couldn't go anywhere once photos were downloaded.
alter table photos add column caption text check (char_length(caption) <= 140);

drop table photo_comments;
alter table photos drop column comment_count;
update plans set features = features - 'comments';
update events set plan_snapshot = jsonb_set(plan_snapshot, '{features}', (plan_snapshot->'features') - 'comments')
  where plan_snapshot ? 'features';
update events set overrides = jsonb_set(overrides, '{features}', (overrides->'features') - 'comments')
  where overrides ? 'features';

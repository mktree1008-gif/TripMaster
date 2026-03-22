'use client';

import { useEffect, useMemo, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { apiFetch } from '@/lib/client-api';
import { CommentEntry, LanguageCode } from '@/lib/types';
import { translateText } from '@/lib/translate-client';

interface CommentsThreadProps {
  supabase: SupabaseClient;
  tripId: string;
  targetType: 'diary' | 'record' | 'music' | 'tripstargram';
  targetId: string;
  language: LanguageCode;
  autoTranslate: boolean;
}

const emojiOptions = ['💡', '❤️', '👍', '🔥', '👏'];

export function CommentsThread({
  supabase,
  tripId,
  targetType,
  targetId,
  language,
  autoTranslate,
}: CommentsThreadProps) {
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  const labels = useMemo(() => {
    if (language === 'ko') {
      return {
        placeholder: '댓글을 남겨보세요',
        send: '댓글 등록',
      };
    }
    return {
      placeholder: 'Write a friendly comment',
      send: 'Post',
    };
  }, [language]);

  async function load() {
    const res = await apiFetch<CommentEntry[]>(
      supabase,
      `/api/comments?tripId=${tripId}&targetType=${targetType}&targetId=${targetId}`,
      { method: 'GET' }
    );
    if (res.ok && res.data) {
      setComments(res.data);
    }
  }

  async function postComment() {
    if (!text.trim()) return;
    await apiFetch(supabase, '/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        tripId,
        targetType,
        targetId,
        content: text.trim(),
        emoji: selectedEmoji,
      }),
    });
    setText('');
    setSelectedEmoji(null);
    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, targetType, targetId]);

  useEffect(() => {
    if (!autoTranslate) {
      setTranslatedMap({});
      return;
    }

    const run = async () => {
      const entries = await Promise.all(
        comments.map(async (comment) => {
          const translated = await translateText(comment.content, language);
          return [comment.id, translated] as const;
        })
      );
      setTranslatedMap(Object.fromEntries(entries));
    };
    run();
  }, [comments, language, autoTranslate]);

  return (
    <div className="comment-thread">
      <div className="comment-list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment-bubble">
            <p>
              <strong>{comment.authorNickname}</strong>
            </p>
            <p>{autoTranslate ? translatedMap[comment.id] ?? comment.content : comment.content}</p>
            {comment.emoji ? <p className="comment-emoji">{comment.emoji}</p> : null}
          </div>
        ))}
      </div>

      <div className="comment-compose">
        <div className="emoji-picker">
          {emojiOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={selectedEmoji === emoji ? 'emoji-btn is-selected' : 'emoji-btn'}
              onClick={() => setSelectedEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={text}
          placeholder={labels.placeholder}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={postComment}>
          {labels.send}
        </button>
      </div>
    </div>
  );
}

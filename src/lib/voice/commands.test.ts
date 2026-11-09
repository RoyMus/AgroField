import { describe, it, expect } from 'vitest';
import { matchCommand, CommandWords } from './commands';
import { classifyTranscript } from '@/hooks/useVoiceRecording';

const he: CommandWords = {
  skip: ['דלג', 'הבא'],
  back: ['חזור', 'אחורה'],
  delete: ['מחק', 'נקה'],
  save: ['שמור', 'סיום', 'סיימתי'],
  stop: ['עצור', 'הפסק', 'תפסיק', 'תעצור'],
  exactOnly: { skip: ['אבא', 'דלק', 'דלת'], stop: ['די'] },
};

describe('matchCommand', () => {
  it.each([
    ['דלג', 'skip'], ['הבא', 'skip'], ['אבא', 'skip'], ['דלת', 'skip'], ['דלג.', 'skip'],
    ['חזור', 'back'], ['אחורה', 'back'], ['מחק', 'delete'], ['שמור', 'save'], ['סיום', 'save'],
    ['בבקשה דלג', 'skip'],
    ['עצור', 'stop'], ['עצור הקלטה', 'stop'], ['תפסיק', 'stop'], ['די', 'stop'], ['הפסק להקליט', 'stop'],
  ])('%s → %s', (text, cmd) => {
    expect(matchCommand(text, he)?.command).toBe(cmd);
  });

  it.each([
    'העלה הבא נראה בריא',
    'אבא שלי בשדה',
    'הדלת של החממה פתוחה',
    'מחקר על העלים בחלק הצפוני',
    'דלקת בשורשים',
    'שבע',
    'עצור את ההשקיה בחממה הצפונית',
    'די צהוב העלה',
  ])('no command in "%s"', text => {
    expect(matchCommand(text, he)).toBeNull();
  });

  it('save at the end of a long sentence keeps the text', () => {
    expect(matchCommand('העלים בצד הצפוני צהובים שמור', he)).toEqual({
      command: 'save',
      rest: 'העלים בצד הצפוני צהובים',
    });
  });
});

describe('classifyTranscript', () => {
  const config = { speechLang: 'he-IL', numberWords: {}, decimalWord: 'נקודה', commands: he };

  it('number', () => {
    expect(classifyTranscript(['עשרים ושלוש נקודה חמש'], config)).toEqual({ kind: 'number', value: '23.5' });
  });
  it('command rescued from an alternative for a short utterance', () => {
    expect(classifyTranscript(['דלי', 'דלג'], config)).toMatchObject({ kind: 'command', command: 'skip' });
  });
  it('long text is not hijacked by a command in an alternative', () => {
    expect(classifyTranscript(['העלים בחלק הצפוני צהובים', 'העלים הבא צהובים דלג'], config))
      .toEqual({ kind: 'text', text: 'העלים בחלק הצפוני צהובים' });
  });
  it('number from an alternative for a short utterance', () => {
    expect(classifyTranscript(['שבוע', 'שבע'], config)).toEqual({ kind: 'number', value: '7' });
  });
  it('text', () => {
    expect(classifyTranscript(['עלה צהוב'], config)).toEqual({ kind: 'text', text: 'עלה צהוב' });
  });
});

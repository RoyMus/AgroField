import { useLang, SupportedLang } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LABELS: Record<SupportedLang, string> = { he: 'עברית', en: 'English', th: 'ภาษาไทย' };

const LanguageSwitcher = () => {
  const { lang, setLang } = useLang();
  return (
    <Select value={lang} onValueChange={(v) => setLang(v as SupportedLang)}>
      <SelectTrigger className="h-8 w-[120px] text-xs font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(['he', 'en', 'th'] as SupportedLang[]).map((l) => (
          <SelectItem key={l} value={l} className="text-xs">
            {LABELS[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSwitcher;

import { observer } from 'mobx-react-lite';
import { lang, SupportedLang } from '@/stores';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

const LABELS: Record<SupportedLang, string> = { he: 'עברית', en: 'English', th: 'ภาษาไทย' };

const LanguageSwitcher = () => {
  return (
    <Select
      value={lang.lang}
      onChange={(e) => lang.setLang(e.target.value as SupportedLang)}
      variant="outlined"
      className="h-8 w-[120px] text-xs font-semibold rounded-md border border-input bg-background [&_.MuiOutlinedInput-notchedOutline]:border-0 [&_.MuiSelect-select]:flex [&_.MuiSelect-select]:h-full [&_.MuiSelect-select]:items-center [&_.MuiSelect-select]:py-0 [&_.MuiSelect-select]:pl-3 [&_.MuiSelect-select]:pr-8"
    >
      {(['he', 'en', 'th'] as SupportedLang[]).map((l) => (
        <MenuItem key={l} value={l} className="text-xs">
          {LABELS[l]}
        </MenuItem>
      ))}
    </Select>
  );
};

export default observer(LanguageSwitcher);

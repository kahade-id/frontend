import { useTranslation } from 'react-i18next';
import { Globe } from '@phosphor-icons/react';
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import i18n from '@kahade/utils';

const languages = [
 { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
 { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

export function LanguageSwitcher() {
 const { t } = useTranslation();
 const currentLang = i18n.language;

 const handleLanguageChange = (lang: 'id' | 'en') => {
   i18n.changeLanguage(lang);
   // Force reload to apply changes
   window.location.reload();
 };

 const currentLanguage = languages.find((l) => l.code === currentLang) || languages[0]!;

 return (
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Button variant="ghost" size="sm" className="gap-2">
         <Globe className="h-4 w-4" aria-hidden="true" />
         <span className="hidden sm:inline">{currentLanguage.flag} {currentLanguage.name}</span>
         <span className="sm:hidden">{currentLanguage.flag}</span>
       </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end">
       {languages.map((lang) => (
         <DropdownMenuItem
           key={lang.code}
           onClick={() => handleLanguageChange(lang.code)}
           className={currentLang === lang.code ? 'bg-accent' : ''}
         >
           <span className="mr-2">{lang.flag}</span>
           {lang.name}
         </DropdownMenuItem>
       ))}
     </DropdownMenuContent>
   </DropdownMenu>
 );
}

// Compact version for mobile/sidebar
export function LanguageSwitcherCompact() {
 const currentLang = i18n.language;

 const handleLanguageChange = (lang: 'id' | 'en') => {
   i18n.changeLanguage(lang);
   window.location.reload();
 };

 return (
   <div className="flex items-center gap-1">
     {languages.map((lang) => (
       <Button
         key={lang.code}
         variant={currentLang === lang.code ? 'default' : 'ghost'}
         size="sm"
         onClick={() => handleLanguageChange(lang.code)}
         className="px-2"
       >
         {lang.flag}
       </Button>
     ))}
   </div>
 );
}

export default LanguageSwitcher;

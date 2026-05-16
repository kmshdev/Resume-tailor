# i18n Preparation Guide

> Plan for internationalizing Resume Matcher.

## Current State

- UI uses a lightweight JSON import approach with locale files in `messages/`
- Content language preference stored via `LanguageProvider`
- Supported: en, es, zh, ja, pt-BR

## Translation File Location

```
apps/frontend/messages/
├── en.json
├── es.json
├── zh.json
├── ja.json
└── pt-BR.json
```

## Adding New Locale

1. Create `messages/{locale}.json`
2. Add locale to `i18n/config.ts`:
   ```typescript
   export const locales = ['en', 'es', 'zh', 'ja', 'pt-BR', 'de'] as const;
   ```
3. Add to `SUPPORTED_LANGUAGES` in backend `config.py`

## Translation Keys

```json
{
  "dashboard": {
    "title": "Dashboard",
    "masterResume": "Master Resume"
  },
  "builder": {
    "save": "Save",
    "download": "Download PDF"
  }
}
```

## Usage in Components

```tsx
import { useTranslations } from '@/lib/i18n';

export function MyComponent() {
  const { t } = useTranslations();
  return <h1>{t('dashboard.title')}</h1>;
}
```

## Content Language vs UI Language

- **UI Language:** Controlled by local JSON messages, affects interface text
- **Content Language:** Controlled by `LanguageProvider`, affects LLM-generated content (cover letters, tailored resumes)

## Backend i18n (Future)

Currently prompts are English-only. To support multiple languages:
1. Create `app/i18n/locales/{lang}.json`
2. Add language parameter to prompt templates
3. Pass `Accept-Language` header from frontend

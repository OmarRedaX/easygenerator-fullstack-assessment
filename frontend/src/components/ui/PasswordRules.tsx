import type { PasswordRules as Rules } from '../../lib/validation/password-policy';

const ITEMS: readonly { key: keyof Rules; label: string }[] = [
  { key: 'length', label: '8+ characters' },
  { key: 'letter', label: 'A letter' },
  { key: 'digit', label: 'A number' },
  { key: 'special', label: 'A symbol' },
];

interface PasswordRulesProps {
  rules: Rules;
  id?: string;
}

/** Live checklist. State is conveyed by text for assistive technology and by the check mark, never by colour alone. */
export function PasswordRules({ rules, id }: PasswordRulesProps) {
  return (
    <ul id={id} aria-live="polite" className="mx-0.5 mt-2.5 mb-0 grid list-none grid-cols-2 gap-x-2.5 gap-y-1.5 p-0">
      {ITEMS.map(({ key, label }) => {
        const met = rules[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-2 text-[12.5px] transition-colors duration-200 ${met ? 'text-text' : 'text-muted'}`}
          >
            <span
              aria-hidden="true"
              className={`grid size-4 flex-none place-items-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-250 ease-soft ${
                met ? 'scale-105 border-ok bg-ok' : 'border-line bg-transparent'
              }`}
            >
              <svg
                viewBox="0 0 12 12"
                className={`size-2.5 fill-none stroke-white transition-[opacity,transform] duration-300 ease-soft ${
                  met ? 'scale-100 opacity-100' : 'scale-40 opacity-0'
                }`}
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m2.5 6.5 2.3 2.3 4.7-5" />
              </svg>
            </span>
            {label}
            <span className="sr-only">{met ? 'met' : 'not met'}</span>
          </li>
        );
      })}
    </ul>
  );
}

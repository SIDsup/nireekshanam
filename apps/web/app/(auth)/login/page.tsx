import { BrandMark, Icon } from '@/components/ui/icon';
import { isDemoOtp } from '@/lib/otp';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen flex-wrap bg-ground">
      <section className="relative flex min-w-0 flex-[1_1_480px] flex-col justify-between gap-10 overflow-hidden bg-forest px-[clamp(24px,4vw,64px)] py-10 text-forest-text">
        <FieldIllustration />
        <div className="relative flex items-center gap-3">
          <BrandMark size={40} />
          <span className="text-[19px] font-semibold tracking-[-0.01em] text-white">Nireekshanam</span>
        </div>
        <div className="relative flex max-w-[500px] flex-col gap-[22px]">
          <h1 className="text-[clamp(34px,4vw,52px)] leading-[1.04] font-semibold tracking-[-0.035em] text-white">Every lot, from first sowing to final seed.</h1>
          <p className="text-base leading-relaxed text-[#afc2b7]">Geo-fenced field records, stage by stage, for hybrid vegetable seed production. Captured offline in the field, verified here.</p>
          <div className="flex flex-wrap gap-2.5">
            {([['pin', 'GPS and geo-fence on every record'], ['sync', 'Offline-first sync'], ['shield', 'Full audit trail']] as const).map(([icon, label]) => (
              <span key={label} className="flex items-center gap-2 rounded-full border border-forest-line bg-forest-2/80 px-3.5 py-2 text-[13px] text-[#dce7e0]">
                <Icon name={icon} size={15} strokeWidth={2} className="text-leaf" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-[12.5px] text-[#7e9187]">Nireekshanam (నిరీక్షణం): observation, inspection.</p>
      </section>
      <section className="flex min-w-0 flex-[1_1_440px] items-center justify-center px-[clamp(20px,4vw,64px)] py-10">
        <LoginForm next={next} demo={isDemoOtp()} />
      </section>
    </div>
  );
}

function FieldIllustration() {
  const rows = Array.from({ length: 13 }, (_, i) => i);
  return (
    <svg viewBox="0 0 640 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 size-full">
      <g fill="none" stroke="#183426" strokeWidth="1.2">
        <path d="M-20 120 L180 96 L200 250 L-10 272 Z" /><path d="M188 94 L380 72 L398 226 L208 248 Z" /><path d="M388 70 L660 40 L670 196 L406 224 Z" />
        <path d="M-10 284 L204 262 L222 430 L4 452 Z" /><path d="M410 236 L672 208 L684 380 L428 406 Z" /><path d="M12 466 L228 444 L246 610 L26 634 Z" />
        <path d="M236 442 L436 420 L452 584 L254 606 Z" /><path d="M444 418 L688 392 L700 560 L460 582 Z" /><path d="M30 648 L250 622 L262 760 L40 780 Z" /><path d="M262 620 L462 598 L474 760 L272 780 Z" />
      </g>
      <g stroke="#132B1F" strokeWidth="1">
        {rows.map((i) => <path key={i} d={`M${218 + i * 14} ${268 - i * 1.5} L${236 + i * 14} ${432 - i * 1.5}`} />)}
      </g>
      <path d="M212 258 L404 236 L422 408 L232 430 Z" fill="#12301F" stroke="#8FE0A0" strokeWidth="2" strokeDasharray="7 6" />
      <g fill="#0D1C15" stroke="#8FE0A0" strokeWidth="2">
        <circle cx="212" cy="258" r="6" /><circle cx="404" cy="236" r="6" /><circle cx="422" cy="408" r="6" /><circle cx="232" cy="430" r="6" />
      </g>
      <circle cx="318" cy="332" r="34" fill="#8FE0A0" fillOpacity="0.12" />
      <circle cx="318" cy="332" r="16" fill="none" stroke="#8FE0A0" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="318" cy="332" r="8" fill="#8FE0A0" />
    </svg>
  );
}

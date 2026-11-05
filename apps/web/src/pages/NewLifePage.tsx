import { NewLife } from '../components/life/NewLife';
import { SaveList } from '../components/SaveList';
import { t } from '../i18n/it';

/** /nuova-vita — available whether or not a life is open; the open life stays saved. */
export function NewLifePage() {
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.newLife.title}</h1>
      <NewLife />
      <SaveList />
    </div>
  );
}

import { ApplicationPresentationHost } from '@/ApplicationPresentationHost'
import { SessionPackageImportError } from '@/components/SessionPackageImportError'
import { SessionPackageOperation } from '@/components/SessionPackageOperation'
import { SettingsWindowBackdrop } from '@/components/SettingsWindowBackdrop'

const App = (): React.JSX.Element => (
  <>
    <ApplicationPresentationHost />
    <SessionPackageOperation />
    <SessionPackageImportError />
    <SettingsWindowBackdrop />
  </>
)

export default App

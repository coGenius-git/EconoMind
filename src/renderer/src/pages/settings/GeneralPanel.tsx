import { ExternalLink, FolderOpen, Terminal } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { DiagnosticDetails } from '@/components/diagnostic-details'
import { LanguageSelect } from '@/components/LanguageControls'
import { ThemeSegmentedControl } from '@/components/ThemeControls'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { errorDetail } from '@/lib/error-detail'
import { useSettingsStore } from '@/stores/settings-store'
import type { CloseActionPreference } from '../../../../shared/window-controls'
import type { CliLauncherStatus } from '../../../../shared/cli'
import type { LogFileStatus, LogWriteFailureCategory } from '../../../../shared/logs'
import { APP } from '../../../../shared/app-config'
import type {
  NotificationDesktopAvailability,
  NotificationTestResult
} from '../../../../shared/notifications'
import { AppVersionSection } from './AppVersionSection'
import { SettingsRow, SettingsSection, SettingsToggle } from './SettingsLayout'

type GeneralActionError = {
  action: 'cli' | 'cli-status' | 'open-log' | 'reveal-log'
  detail?: string
}

const generalActionErrorCopy = (error: GeneralActionError, t: TFunction): string => {
  switch (error.action) {
    case 'cli':
      return t('Could not update the command-line tool.')
    case 'cli-status':
      return t('Could not check the command-line tool.')
    case 'open-log':
      return t('Could not open the log file.')
    case 'reveal-log':
      return t('Could not reveal the log file.')
  }
}

const logFailureCopy = (category: LogWriteFailureCategory | null, t: TFunction): string => {
  switch (category) {
    case 'directory':
      return t('The log folder could not be created.')
    case 'inspect':
      return t('The log file could not be checked.')
    case 'rotation':
      return t('The log backups could not be rotated.')
    case 'append':
      return t('The log record could not be appended.')
    default:
      return ''
  }
}

const GeneralPanel = (): React.JSX.Element => {
  const { t } = useTranslation()
  const isMac = window.api.platform === 'darwin'
  const [logStatus, setLogStatus] = useState<LogFileStatus | null>(null)
  const [isCheckingLog, setIsCheckingLog] = useState(true)
  const [logStatusError, setLogStatusError] = useState<string>()
  const logStatusRequest = useRef(0)

  const checkLogStatus = useCallback((): Promise<void> => {
    const request = ++logStatusRequest.current
    return Promise.resolve()
      .then(() => window.api.logs.getStatus())
      .then(
        (status) => {
          if (request !== logStatusRequest.current) return
          setLogStatus(status)
          setLogStatusError(undefined)
        },
        (error: unknown) => {
          if (request !== logStatusRequest.current) return
          setLogStatusError(errorDetail(error) ?? '')
        }
      )
      .finally(() => {
        if (request === logStatusRequest.current) setIsCheckingLog(false)
      })
  }, [])

  const refreshLogStatus = useCallback((): Promise<void> => {
    setIsCheckingLog(true)
    return checkLogStatus()
  }, [checkLogStatus])

  useEffect(() => {
    void checkLogStatus()
    window.addEventListener('focus', refreshLogStatus)
    return () => {
      window.removeEventListener('focus', refreshLogStatus)
      logStatusRequest.current += 1
    }
  }, [checkLogStatus, refreshLogStatus])
  const [message, setMessage] = useState<GeneralActionError | undefined>(undefined)
  const [isOpening, setIsOpening] = useState(false)
  const [cli, setCli] = useState<CliLauncherStatus | null>(null)
  const [isUpdatingCli, setIsUpdatingCli] = useState(false)
  const [cliError, setCliError] = useState<GeneralActionError | undefined>(undefined)
  const [notificationAvailability, setNotificationAvailability] =
    useState<NotificationDesktopAvailability>('unavailable')
  const [notificationTestResult, setNotificationTestResult] = useState<NotificationTestResult>()
  const [isTestingNotification, setIsTestingNotification] = useState(false)
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled)
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled)
  const showNotificationContent = useSettingsStore((state) => state.showNotificationContent)
  const setShowNotificationContent = useSettingsStore((state) => state.setShowNotificationContent)
  const closePreference = useSettingsStore((state) => state.closePreference)
  const setClosePreference = useSettingsStore((state) => state.setClosePreference)

  const checkCliStatus = async (): Promise<void> => {
    setIsUpdatingCli(true)

    try {
      setCli(await window.api.cli.getStatus())
      setCliError(undefined)
    } catch (error) {
      setCliError({ action: 'cli-status', detail: errorDetail(error) })
    } finally {
      setIsUpdatingCli(false)
    }
  }

  useEffect(() => {
    void window.api.cli.getStatus().then(setCli, (error) => {
      setCliError({ action: 'cli-status', detail: errorDetail(error) })
    })
    const getAvailability = window.api.notifications.getDesktopAvailability
    if (getAvailability) {
      void getAvailability()
        .then(setNotificationAvailability)
        .catch(() => {
          setNotificationAvailability('unavailable')
        })
    }
  }, [])

  const logPath = logStatus?.path ?? null
  const logExists = logStatus?.existing === true

  const handleTestNotification = async (): Promise<void> => {
    const sendTest = window.api.notifications.sendTest
    if (!sendTest) return

    setIsTestingNotification(true)
    setNotificationTestResult(undefined)
    try {
      setNotificationTestResult(await sendTest())
    } catch {
      setNotificationTestResult('failed')
    } finally {
      setIsTestingNotification(false)
    }
  }

  const handleCli = async (action: 'install' | 'uninstall'): Promise<void> => {
    setIsUpdatingCli(true)
    setCliError(undefined)

    try {
      setCli(
        action === 'install' ? await window.api.cli.install() : await window.api.cli.uninstall()
      )
    } catch (error) {
      setCliError({ action: 'cli', detail: errorDetail(error) })
    } finally {
      setIsUpdatingCli(false)
    }
  }

  const handleOpenLog = async (): Promise<void> => {
    setIsOpening(true)
    setMessage(undefined)

    try {
      const result = await window.api.logs.openFile()

      if (!result.opened) {
        setMessage({ action: 'open-log', detail: result.error })
      }
    } catch (error) {
      setMessage({ action: 'open-log', detail: errorDetail(error) })
    } finally {
      await refreshLogStatus()
      setIsOpening(false)
    }
  }

  const handleReveal = async (): Promise<void> => {
    setMessage(undefined)

    try {
      const result = await window.api.logs.revealInFolder()

      if (!result.revealed) {
        setMessage({ action: 'reveal-log', detail: result.error })
      }
    } catch (error) {
      setMessage({ action: 'reveal-log', detail: errorDetail(error) })
    } finally {
      await refreshLogStatus()
    }
  }

  return (
    <div className="space-y-5 p-5">
      <AppVersionSection />

      <SettingsSection
        title={t('Appearance')}
        description={t(
          'Choose how the app looks and reads. System follows your device; the other choices stay fixed. Your selection is remembered on this device.'
        )}
        aria-label={t('Appearance')}
      >
        <SettingsRow
          label={t('Theme')}
          description={
            isMac
              ? t(
                  'Follow the system setting, or force light or dark. The Dock icon follows the resolved theme.'
                )
              : t('Follow the system setting, or force light or dark.')
          }

          className="pt-0"
          controlClassName="flex justify-end"
        >
          <ThemeSegmentedControl />
        </SettingsRow>

        <SettingsRow
          label={t('Language')}
          description={t(
            'Follow the system setting, or pick a language. System is detected once at startup, so a change to your device language takes effect the next time the app opens.'
          )}
        >
          <LanguageSelect />
        </SettingsRow>
      </SettingsSection>

      {window.api.platform === 'win32' && window.api.window?.onCloseConfirmRequest ? (
        <SettingsSection
          title={t('Window behavior')}
          description={t('Choose what the titlebar close button does.')}
          aria-label={t('Window behavior')}
        >
          <SettingsRow
            label={t('When closing the window')}
            description={t(
              'Ask each time, keep {{appName}} running in the tray, or quit the app.',
              {
                appName: APP.name
              }
            )}
            className="pt-0"
          >
            <Select
              value={closePreference ?? 'ask'}
              onValueChange={(value) =>
                void setClosePreference(
                  value === 'ask' ? undefined : (value as CloseActionPreference)
                )
              }
            >
              <SelectTrigger aria-label={t('When closing the window')}>
                <span>
                  {closePreference === 'minimize'
                    ? t('Minimize to tray')
                    : closePreference === 'quit'
                      ? t('Quit')
                      : t('Ask every time')}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">{t('Ask every time')}</SelectItem>
                <SelectItem value="minimize">{t('Minimize to tray')}</SelectItem>
                <SelectItem value="quit">{t('Quit')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t('Notifications')}
        description={t(
          "Get a desktop notification when a task finishes, fails, or waits for your approval while you're away from the app."
        )}
        aria-label={t('Notifications')}
      >
        <SettingsRow
          label={t('Task notifications')}
          description={t(
            'Selecting a notification brings {{appName}} back to the front and opens the task.',
            {
              appName: APP.name
            }
          )}
          className="pt-0"
        >
          <div className="flex justify-end">
            <SettingsToggle
              enabled={notificationsEnabled}
              aria-label={t('Toggle task notifications')}
              onToggle={() => void setNotificationsEnabled(!notificationsEnabled)}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label={t('Show task content in system notifications')}
          description={t(
            'Include task names and request details. Provider errors are always hidden.'
          )}
        >
          <div className="flex justify-end">
            <SettingsToggle
              enabled={showNotificationContent}
              disabled={!notificationsEnabled}
              aria-label={t('Toggle task content in system notifications')}
              onToggle={() => void setShowNotificationContent(!showNotificationContent)}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          label={t('System notification status')}
          description={
            notificationAvailability === 'supported'
              ? t('System notifications are supported on this device.')
              : t('System notifications are unavailable on this device.')
          }
        >
          <div className="flex flex-col items-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={notificationAvailability !== 'supported' || isTestingNotification}
              onClick={() => void handleTestNotification()}
            >
              {isTestingNotification ? t('Sending test…') : t('Send test notification')}
            </Button>
            {notificationTestResult ? (
              <p className="text-right text-xs text-muted-foreground" role="status">
                {notificationTestResult === 'shown'
                  ? t('Test notification shown.')
                  : notificationTestResult === 'failed'
                    ? t('Test notification failed.')
                    : notificationTestResult === 'unconfirmed'
                      ? t('Test notification sent, but display could not be confirmed.')
                      : t('System notifications are unavailable on this device.')}
              </p>
            ) : null}
          </div>
        </SettingsRow>

        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "Notifications only appear while you're using another app. Tasks you cancel and failures the app retries automatically stay silent. Your operating system may ask for notification permission the first time one appears."
          )}
        </p>
      </SettingsSection>

      <SettingsSection
        title={t('Diagnostics')}
        description={t(
          "View this device's runtime log — it records what the app is doing so problems can be diagnosed."
        )}
        aria-label={t('Diagnostics')}
      >
        <SettingsRow
          label={t('Log file')}
          controlClassName="w-auto justify-self-end"
          className="pt-0"
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleReveal()}
              disabled={!logExists}
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              {t('Reveal')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleOpenLog()}
              disabled={isOpening || !logExists}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {isOpening ? t('Opening…') : t('Open')}
            </Button>
          </div>
        </SettingsRow>

        <pre
          className="overflow-x-auto rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-xs text-foreground"
          aria-label={t('Log file path')}
        >
          {logPath ??
            (isCheckingLog
              ? t('Loading…')
              : logStatusError !== undefined
                ? '—'
                : t('Not available yet.'))}
        </pre>

        {logStatus &&
        logPath &&
        !logExists &&
        !isCheckingLog &&
        logStatusError === undefined &&
        !logStatus.lastFailureCategory ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {t('Not available yet.')}
          </p>
        ) : null}

        {logStatusError !== undefined ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-destructive" role="alert">
              {t('Could not check the log file.')}
            </p>
            <DiagnosticDetails detail={logStatusError} />
            <Button
              type="button"
              variant="outline"
              disabled={isCheckingLog}
              onClick={() => void refreshLogStatus()}
            >
              {isCheckingLog ? t('Loading…') : t('Check again')}
            </Button>
          </div>
        ) : null}

        {logStatus && (logStatus.lastWriteSucceeded === false || logStatus.lastFailureCategory) ? (
          <p className="mt-2 text-xs text-destructive" role="status">
            {logStatus.lastWriteSucceeded === false
              ? t('The app could not write to the log file during its most recent attempt.')
              : null}{' '}
            {logFailureCopy(logStatus.lastFailureCategory, t)}
          </p>
        ) : null}

        {message ? (
          <div className="mt-2">
            <p className="text-xs text-destructive" role="alert">
              {generalActionErrorCopy(message, t)}
            </p>
            <DiagnosticDetails detail={message.detail} />
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title={t('Command line tool')}
        description={
          <Trans
            i18nKey="Install the <code>open-science</code> command so you can start, stop, and check the backend from a terminal, then use it entirely from your browser."
            components={{ code: <code className="font-mono" /> }}
          />
        }
        aria-label={t('Command line tool')}
      >
        <SettingsRow
          label={t('open-science')}
          controlClassName="w-auto justify-self-end"
          className="pt-0"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCli(cli?.installed ? 'uninstall' : 'install')}
            disabled={isUpdatingCli || cli === null}
          >
            <Terminal className="size-4" aria-hidden="true" />
            {isUpdatingCli
              ? t('Working…')
              : cli?.installed
                ? t('Uninstall command')
                : t('Install command')}
          </Button>
        </SettingsRow>

        {cli?.installed ? (
          <pre
            className="overflow-x-auto rounded-lg border border-border bg-muted/60 px-3 py-2.5 font-mono text-xs text-foreground"
            aria-label={t('Command line tool path')}
          >
            {cli.target}
          </pre>
        ) : null}

        {cli?.installed && cli.pathHint ? (
          <p className="mt-2 text-xs text-muted-foreground">{cli.pathHint}</p>
        ) : null}

        {cliError ? (
          <div className="mt-2">
            <p className="text-xs text-destructive" role="alert">
              {generalActionErrorCopy(cliError, t)}
            </p>
            <DiagnosticDetails detail={cliError.detail} />
            {cliError.action === 'cli-status' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={isUpdatingCli}
                onClick={() => void checkCliStatus()}
              >
                {isUpdatingCli ? t('Checking…') : t('Check again')}
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          <Trans
            i18nKey="Once installed, run <code>open-science start</code> to launch the backend and open the authenticated URL, then <code>open-science stop</code> to shut it down. <code>status</code> and <code>url</code> are also available."
            components={{ code: <code className="font-mono" /> }}
          />
        </p>
      </SettingsSection>
    </div>
  )
}

export { GeneralPanel }

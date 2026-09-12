import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLoading } from '@/lib/loading-context'

// A Button that participates in the app's shared busy state: while its
// own action is running it shows a spinner, and while ANY LoadingButton's
// action is running, every other one is disabled — so a user can't
// double-submit the same action or fire off a second one mid-request.
export function LoadingButton({ id, onClick, disabled, children, ...props }) {
  const { pendingId, run } = useLoading()
  const isPending = pendingId === id
  const busy = pendingId !== null

  function handleClick(event) {
    run(id, () => onClick(event))
  }

  return (
    <Button {...props} onClick={handleClick} disabled={disabled || busy}>
      {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}

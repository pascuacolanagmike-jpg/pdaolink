interface AlertProps {
  variant: 'danger' | 'success' | 'warning' | 'info'
  message: string
  dismissible?: boolean
}

export default function Alert({ variant, message, dismissible }: AlertProps) {
  return (
    <div className={`alert alert-${variant} ${dismissible ? 'alert-dismissible' : ''} fade show`} role="alert">
      <i
        className={`bi ${
          variant === 'danger'
            ? 'bi-exclamation-circle'
            : variant === 'success'
            ? 'bi-check-circle'
            : variant === 'warning'
            ? 'bi-exclamation-triangle'
            : 'bi-info-circle'
        } me-1`}
      />
      {message}
      {dismissible && (
        <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close" />
      )}
    </div>
  )
}

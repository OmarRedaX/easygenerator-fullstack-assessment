import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { PasswordField } from '../../components/ui/PasswordField';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { signIn } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/errors';
import { signInSchema, type SignInInput, type SignInValues } from '../../lib/validation/schemas';
import { AuthLayout, AuthLink } from './AuthLayout';
import { toFormFeedback } from './formErrors';
import { returnPathFromState } from './safeReturnPath';
import { useStartSession } from './session';

interface Alerted {
  message: string;
  requestId?: string;
}

export function SignInPage() {
  useDocumentTitle('Sign in - Easygenerator');
  const navigate = useNavigate();
  const location = useLocation();
  const startSession = useStartSession();
  const [alert, setAlert] = useState<Alerted | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues, unknown, SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: SignInInput) => {
    setAlert(null);
    try {
      const user = await signIn(values);
      await startSession(user);
      void navigate(returnPathFromState(location.state), { replace: true });
    } catch (error) {
      const feedback = toFormFeedback(error, 'signin');
      // A server rule the client check missed (400 with details): show it on its field and focus the first one.
      let firstInvalid: 'email' | 'password' | undefined;
      for (const field of ['email', 'password'] as const) {
        const message = feedback.fieldErrors[field];
        if (message) {
          setError(field, { type: 'server', message });
          firstInvalid ??= field;
        }
      }
      if (firstInvalid) setFocus(firstInvalid);
      // This form has no name field, so a detail about it goes in the alert instead of being dropped.
      const nameDetail = feedback.fieldErrors.name ? `name: ${feedback.fieldErrors.name}` : undefined;
      const message = [feedback.message, nameDetail].filter(Boolean).join(' ');
      if (message) {
        setAlert({ message, ...(feedback.requestId ? { requestId: feedback.requestId } : {}) });
      }
      // Wrong credentials: the password is the likelier typo, and the values stay in place.
      if (error instanceof ApiError && error.status === 401) setFocus('password');
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back."
      footer={
        <>
          New here?
          <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      <form
        noValidate
        aria-busy={isSubmitting || undefined}
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        {alert && <Alert requestId={alert.requestId}>{alert.message}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          readOnly={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          readOnly={isSubmitting}
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { PasswordField } from '../../components/ui/PasswordField';
import { PasswordRules } from '../../components/ui/PasswordRules';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { signUp } from '../../lib/api/auth';
import { evaluatePassword } from '../../lib/validation/password-policy';
import { signUpSchema, type SignUpInput, type SignUpValues } from '../../lib/validation/schemas';
import { AuthLayout, AuthLink } from './AuthLayout';
import { toFormFeedback, type FormField } from './formErrors';
import { returnPathFromState } from './safeReturnPath';
import { useStartSession } from './session';

const FIELD_ORDER: readonly FormField[] = ['name', 'email', 'password'];

interface Alerted {
  message: string;
  requestId?: string;
}

export function SignUpPage() {
  useDocumentTitle('Create account - Easygenerator');
  const navigate = useNavigate();
  const location = useLocation();
  const startSession = useStartSession();
  const rulesId = useId();
  const [alert, setAlert] = useState<Alerted | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues, unknown, SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });
  const rules = evaluatePassword(useWatch({ control, name: 'password' }));

  const onSubmit = async (values: SignUpInput) => {
    setAlert(null);
    try {
      const user = await signUp(values);
      await startSession(user);
      void navigate(returnPathFromState(location.state), { replace: true });
    } catch (error) {
      const feedback = toFormFeedback(error, 'signup');
      for (const field of FIELD_ORDER) {
        const message = feedback.fieldErrors[field];
        if (message) setError(field, { type: 'server', message });
      }
      const firstInvalid = FIELD_ORDER.find((field) => feedback.fieldErrors[field]);
      if (firstInvalid) setFocus(firstInvalid);
      if (feedback.message) {
        setAlert({ message: feedback.message, ...(feedback.requestId ? { requestId: feedback.requestId } : {}) });
      }
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It only takes a minute."
      footer={
        <>
          Already have an account?
          <AuthLink to="/signin">Sign in</AuthLink>
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
          label="Name"
          autoComplete="name"
          readOnly={isSubmitting}
          error={errors.name?.message}
          {...register('name')}
        />
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
          autoComplete="new-password"
          aria-describedby={rulesId}
          readOnly={isSubmitting}
          error={errors.password?.message}
          hint={<PasswordRules id={rulesId} rules={rules} />}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

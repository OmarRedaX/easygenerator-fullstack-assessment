import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  DIGIT_RE, LETTER_RE, PASSWORD_MAX_LENGTH, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH, SPECIAL_RE,
} from '../password-policy';

export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);
export const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignUpDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(3, 80, { message: 'name must be between 3 and 80 characters' })
  name!: string;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_MESSAGES.length })
  @Matches(LETTER_RE, { message: PASSWORD_MESSAGES.letter })
  @Matches(DIGIT_RE, { message: PASSWORD_MESSAGES.digit })
  @Matches(SPECIAL_RE, { message: PASSWORD_MESSAGES.special })
  password!: string;
}

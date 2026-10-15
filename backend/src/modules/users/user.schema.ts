import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 80 })
  name!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Ambient module declarations fallback for build environments
declare module 'bcryptjs';
declare module 'jsonwebtoken';
declare module 'pdfkit';
declare module 'nodemailer' {
  const nodemailer: any;
  export type Transporter = any;
  export default nodemailer;
}
declare module 'multer';

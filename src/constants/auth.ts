export type UserRole = 
  | 'Super Admin'
  | 'Owner'
  | 'Finance'
  | 'Operations'
  | 'Marketing'
  | 'Customer Support'
  | 'User';

export const getRedirectPathForRole = (role: UserRole | string): string => {
  switch (role) {
    case 'Super Admin':
      return '/dashboard/owner';
    case 'Owner':
      return '/dashboard/owner';
    case 'Finance':
      return '/dashboard/finance';
    case 'Operations':
      return '/dashboard/operations';
    case 'Marketing':
      return '/dashboard/marketing';
    case 'Customer Support':
      return '/dashboard/customer-support';
    case 'User':
    default:
      return '/dashboard';
  }
};

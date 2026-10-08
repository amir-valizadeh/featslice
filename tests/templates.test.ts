import {
  getNextSliceTemplate,
  getNextLayoutTemplate,
  getNextCommonTemplates,
} from '../src/templates/next';
import {
  getReactSliceTemplate,
  getReactLayoutTemplate,
  getReactCommonTemplates,
} from '../src/templates/react';
import { getServiceTemplate } from '../src/templates/service';

describe('templates', () => {
  describe('next templates', () => {
    it('generates next slice template correctly', () => {
      const result = getNextSliceTemplate('login');
      expect(result).toContain('export default function LoginPage()');
      expect(result).toContain('<h1 className="text-2xl font-bold mb-4">Login</h1>');
    });

    it('generates next layout template correctly', () => {
      const result = getNextLayoutTemplate();
      expect(result).toContain('export default function Layout({');
      expect(result).toContain('children: React.ReactNode;');
    });

    it('generates common next templates for types, hooks, utils, constants', () => {
      const types = getNextCommonTemplates('types', 'auth');
      expect(types).toContain('export interface IAuthProps');
      expect(types).toContain('export interface IAuthState');
      expect(types).toContain('export type TAuthResponse');

      const hooks = getNextCommonTemplates('hooks', 'auth');
      expect(hooks).toContain('export const useAuth = () =>');
      expect(hooks).toContain('useState<IAuthState>()');

      const utils = getNextCommonTemplates('utils', 'auth');
      expect(utils).toContain('export const authUtils = {');

      const constants = getNextCommonTemplates('constants', 'auth');
      expect(constants).toContain('export const AUTH_ROUTES = {');
      expect(constants).toContain('export const AUTH_CONFIG = {');

      const components = getNextCommonTemplates('components', 'auth');
      expect(components).toContain('// Auth components exports');
    });
  });

  describe('react templates', () => {
    it('generates react slice template correctly', () => {
      const result = getReactSliceTemplate('register');
      expect(result).toContain('function RegisterPage()');
      expect(result).toContain('export default RegisterPage;');
    });

    it('generates react layout template correctly', () => {
      const result = getReactLayoutTemplate();
      expect(result).toContain('interface LayoutProps');
      expect(result).toContain('export default Layout;');
    });

    it('generates common react templates for types, hooks, utils, constants', () => {
      const types = getReactCommonTemplates('types', 'user-profile');
      expect(types).toContain('export interface IUserProfileProps');
      expect(types).toContain('export interface IUserProfileState');
      expect(types).toContain('export type TUserProfileResponse');

      const hooks = getReactCommonTemplates('hooks', 'user-profile');
      expect(hooks).toContain('export const useUserProfile = () =>');

      const utils = getReactCommonTemplates('utils', 'user-profile');
      expect(utils).toContain('export const user-profileUtils = {');

      const constants = getReactCommonTemplates('constants', 'user-profile');
      expect(constants).toContain('USER-PROFILE_ROUTES');
    });
  });

  describe('service templates', () => {
    it('generates CRUD service template correctly', () => {
      const result = getServiceTemplate('auth');
      expect(result).toContain('TAuthResponse');
      expect(result).toContain('IAuthProps');
      expect(result).toContain('export const authService = {');
      expect(result).toContain('fetchAuth: async (): Promise<TAuthResponse>');
      expect(result).toContain('createAuth: async (data: IAuthProps): Promise<TAuthResponse>');
      expect(result).toContain('updateAuth: async (id: string, data: Partial<IAuthProps>): Promise<TAuthResponse>');
      expect(result).toContain('deleteAuth: async (id: string): Promise<void>');
    });
  });
});

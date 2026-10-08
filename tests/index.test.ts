import * as featslice from '../src/index';

describe('featslice entry point', () => {
  it('exports generateFeature function', () => {
    expect(typeof featslice.generateFeature).toBe('function');
  });

  it('exports utility functions', () => {
    expect(typeof featslice.capitalize).toBe('function');
    expect(typeof featslice.detectFeatureDir).toBe('function');
    expect(typeof featslice.findRootDir).toBe('function');
  });

  it('exports template functions', () => {
    expect(typeof featslice.getNextSliceTemplate).toBe('function');
    expect(typeof featslice.getNextLayoutTemplate).toBe('function');
    expect(typeof featslice.getNextCommonTemplates).toBe('function');
    expect(typeof featslice.getReactSliceTemplate).toBe('function');
    expect(typeof featslice.getReactLayoutTemplate).toBe('function');
    expect(typeof featslice.getReactCommonTemplates).toBe('function');
    expect(typeof featslice.getServiceTemplate).toBe('function');
    expect(typeof featslice.getQueryTemplate).toBe('function');
    expect(typeof featslice.getActionsTemplate).toBe('function');
    expect(typeof featslice.getZustandTemplate).toBe('function');
    expect(typeof featslice.getSliceTestTemplate).toBe('function');
    expect(typeof featslice.getServiceTestTemplate).toBe('function');
    expect(typeof featslice.getActionTestTemplate).toBe('function');
  });

  it('exports template engine functions', () => {
    expect(typeof featslice.renderTemplate).toBe('function');
    expect(typeof featslice.toPascalCase).toBe('function');
    expect(typeof featslice.toKebabCase).toBe('function');
    expect(typeof featslice.buildTemplateVariables).toBe('function');
    expect(typeof featslice.resolveSliceTemplate).toBe('function');
    expect(typeof featslice.resolveLayoutTemplate).toBe('function');
    expect(typeof featslice.resolveServiceTemplate).toBe('function');
    expect(typeof featslice.resolveCommonTemplate).toBe('function');
    expect(typeof featslice.resolveQueryTemplate).toBe('function');
    expect(typeof featslice.resolveActionsTemplate).toBe('function');
    expect(typeof featslice.resolveZustandTemplate).toBe('function');
    expect(typeof featslice.resolveSliceTestTemplate).toBe('function');
    expect(typeof featslice.resolveServiceTestTemplate).toBe('function');
    expect(typeof featslice.resolveActionTestTemplate).toBe('function');
  });

  it('exports config functions', () => {
    expect(typeof featslice.loadConfig).toBe('function');
    expect(typeof featslice.findConfigFile).toBe('function');
    expect(featslice.DEFAULT_CONFIG).toBeDefined();
  });

  it('exports init functions', () => {
    expect(typeof featslice.initProject).toBe('function');
  });

  it('exports manager functions', () => {
    expect(typeof featslice.listFeatures).toBe('function');
    expect(typeof featslice.printFeatureTree).toBe('function');
    expect(typeof featslice.removeFeatureOrSlice).toBe('function');
  });
});

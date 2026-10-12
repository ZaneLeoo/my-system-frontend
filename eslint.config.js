import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'auto-imports.d.ts', 'public/**', 'html/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] }
    },
    rules: {
      // 上游页面保留渐进式类型声明，后续业务代码可以逐步收紧。
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off',
      // 上游表单通过对象 prop 共享编辑状态，允许修改对象属性，仍禁止替换 prop。
      'vue/no-mutating-props': ['error', { shallowOnly: true }],
      'vue/multi-word-component-names': 'off'
    }
  },
  prettier
)

import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeEmpty(): R;
      toBeEmptyDOMElement(): R;
      toBeInTheDocument(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeVisible(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveAccessibleDescription(text?: string | RegExp | ((content: string, element: Element | null) => boolean) | null): R;
      toHaveAccessibleName(text?: string | RegExp | ((content: string, element: Element | null) => boolean) | null): R;
      toHaveAttribute(attr: string, value?: string | RegExp | ((value: string | null) => boolean) | null): R;
      toHaveClass(...classNames: (string | RegExp)[]): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, string | number | boolean | string[]>): R;
      toHaveStyle(css: string | Record<string, string | number>): R;
      toHaveTextContent(text: string | RegExp | ((content: string, element: Element | null) => boolean) | null): R;
      toHaveValue(value?: string | string[] | number | null): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveErrorMessage(text?: string | RegExp | ((content: string, element: Element | null) => boolean) | null): R;
    }
  }
}
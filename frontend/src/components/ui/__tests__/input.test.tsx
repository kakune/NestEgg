import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../input';

describe('Input', () => {
  it('should render with default classes', () => {
    render(<Input placeholder="Test input" />);
    
    const input = screen.getByPlaceholderText('Test input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass(
      'flex',
      'h-10',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'px-3',
      'py-2',
      'text-sm'
    );
  });

  it('should accept custom className', () => {
    render(<Input className="custom-input" placeholder="Test" />);
    
    const input = screen.getByPlaceholderText('Test');
    expect(input).toHaveClass('custom-input');
    expect(input).toHaveClass('flex', 'h-10'); // Should still have default classes
  });

  it('should render with different input types', () => {
    const { rerender } = render(<Input type="text" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'text');

    rerender(<Input type="password" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');

    rerender(<Input type="email" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');

    rerender(<Input type="number" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
  });

  it('should handle disabled state', () => {
    render(<Input disabled placeholder="Disabled input" />);
    
    const input = screen.getByPlaceholderText('Disabled input');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
  });

  it('should handle value changes', async () => {
    const user = userEvent.setup();
    
    render(<Input placeholder="Type here" />);
    
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement;
    
    await user.type(input, 'Hello World');
    expect(input.value).toBe('Hello World');
  });

  it('should handle onChange events', async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Input onChange={handleChange} placeholder="Change test" />);
    
    const input = screen.getByPlaceholderText('Change test');
    
    await user.type(input, 'test');
    expect(handleChange).toHaveBeenCalledTimes(4); // Called for each character
  });

  it('should handle onFocus and onBlur events', async () => {
    const handleFocus = jest.fn();
    const handleBlur = jest.fn();
    const user = userEvent.setup();
    
    render(
      <Input 
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Focus test"
      />
    );
    
    const input = screen.getByPlaceholderText('Focus test');
    
    await user.click(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
    
    await user.tab(); // Focus out
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('should handle controlled input', () => {
    const TestComponent = () => {
      const [value, setValue] = React.useState('initial');
      
      return (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          data-testid="controlled-input"
        />
      );
    };
    
    render(<TestComponent />);
    
    const input = screen.getByTestId('controlled-input') as HTMLInputElement;
    expect(input.value).toBe('initial');
  });

  it('should handle uncontrolled input with defaultValue', () => {
    render(<Input defaultValue="default text" data-testid="uncontrolled" />);
    
    const input = screen.getByTestId('uncontrolled') as HTMLInputElement;
    expect(input.value).toBe('default text');
  });

  it('should forward refs correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    
    render(<Input ref={ref} placeholder="Ref test" />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe('Ref test');
  });

  it('should accept HTML input attributes', () => {
    render(
      <Input
        id="test-input"
        name="test-name"
        placeholder="Test placeholder"
        required
        maxLength={100}
        data-testid="input"
      />
    );
    
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('id', 'test-input');
    expect(input).toHaveAttribute('name', 'test-name');
    expect(input).toHaveAttribute('placeholder', 'Test placeholder');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('maxLength', '100');
  });

  it('should handle different input states visually', () => {
    const { rerender } = render(<Input data-testid="input" />);
    
    const input = screen.getByTestId('input');
    
    // Default state
    expect(input).toHaveClass('border-input');
    
    // Disabled state
    rerender(<Input disabled data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('disabled:opacity-50');
    
    // With error styling (custom class)
    rerender(<Input className="border-red-500" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('border-red-500');
  });

  it('should support file input type', () => {
    render(<Input type="file" data-testid="file-input" />);
    
    const input = screen.getByTestId('file-input');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveClass('file:border-0', 'file:bg-transparent');
  });

  it('should handle keyboard events', async () => {
    const handleKeyDown = jest.fn();
    const handleKeyUp = jest.fn();
    const user = userEvent.setup();
    
    render(
      <Input
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        placeholder="Keyboard test"
      />
    );
    
    const input = screen.getByPlaceholderText('Keyboard test');
    
    await user.type(input, 'a');
    expect(handleKeyDown).toHaveBeenCalled();
    expect(handleKeyUp).toHaveBeenCalled();
  });

  it('should handle special keys', async () => {
    const handleKeyDown = jest.fn();
    const user = userEvent.setup();
    
    render(<Input onKeyDown={handleKeyDown} placeholder="Special keys test" />);
    
    const input = screen.getByPlaceholderText('Special keys test');
    
    await user.type(input, '{enter}');
    expect(handleKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' })
    );
    
    await user.type(input, '{escape}');
    expect(handleKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape' })
    );
  });

  it('should maintain focus styling classes', () => {
    render(<Input placeholder="Focus styling test" />);
    
    const input = screen.getByPlaceholderText('Focus styling test');
    expect(input).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2'
    );
  });

  it('should handle placeholder styling', () => {
    render(<Input placeholder="Placeholder test" />);
    
    const input = screen.getByPlaceholderText('Placeholder test');
    expect(input).toHaveClass('placeholder:text-muted-foreground');
  });

  it('should work with labels correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <>
        <label htmlFor="labeled-input">Test Label</label>
        <Input id="labeled-input" />
      </>
    );
    
    const label = screen.getByText('Test Label');
    const input = screen.getByRole('textbox');
    
    await user.click(label);
    expect(document.activeElement).toBe(input);
  });

  it('should support form validation attributes', async () => {
    render(
      <form>
        <Input
          required
          minLength={5}
          maxLength={10}
          pattern="[A-Za-z]+"
          data-testid="validation-input"
        />
        <button type="submit">Submit</button>
      </form>
    );
    
    const input = screen.getByTestId('validation-input');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('minLength', '5');
    expect(input).toHaveAttribute('maxLength', '10');
    expect(input).toHaveAttribute('pattern', '[A-Za-z]+');
  });

  it('should handle readonly state', () => {
    render(<Input readOnly value="readonly value" data-testid="readonly" />);
    
    const input = screen.getByTestId('readonly');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('readonly value');
  });
});
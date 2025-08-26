import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Label } from '../label';

describe('Label', () => {
  it('should render with default classes', () => {
    render(<Label>Test Label</Label>);
    
    const label = screen.getByText('Test Label');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass(
      'text-sm',
      'font-medium',
      'leading-none',
      'peer-disabled:cursor-not-allowed',
      'peer-disabled:opacity-70'
    );
  });

  it('should accept custom className', () => {
    render(<Label className="custom-label">Custom Label</Label>);
    
    const label = screen.getByText('Custom Label');
    expect(label).toHaveClass('custom-label');
    expect(label).toHaveClass('text-sm', 'font-medium'); // Should still have default classes
  });

  it('should work with htmlFor attribute', async () => {
    const user = userEvent.setup();
    
    render(
      <div>
        <Label htmlFor="test-input">Click me</Label>
        <input id="test-input" type="text" />
      </div>
    );
    
    const label = screen.getByText('Click me');
    const input = screen.getByRole('textbox');
    
    await user.click(label);
    expect(document.activeElement).toBe(input);
  });

  it('should forward refs correctly', () => {
    const ref = React.createRef<HTMLLabelElement>();
    
    render(<Label ref={ref}>Ref Label</Label>);
    
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current?.textContent).toBe('Ref Label');
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Label onClick={handleClick}>Clickable Label</Label>);
    
    const label = screen.getByText('Clickable Label');
    await user.click(label);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should support HTML label attributes', () => {
    render(
      <Label
        htmlFor="form-input"
        id="form-label"
        className="form-label"
      >
        Form Label
      </Label>
    );
    
    const label = screen.getByText('Form Label');
    expect(label).toHaveAttribute('for', 'form-input');
    expect(label).toHaveAttribute('id', 'form-label');
  });

  it('should work with form controls', async () => {
    const user = userEvent.setup();
    
    render(
      <form>
        <Label htmlFor="name">Name</Label>
        <input id="name" type="text" required />
        
        <Label htmlFor="email">Email</Label>
        <input id="email" type="email" required />
        
        <Label htmlFor="agree">
          <input id="agree" type="checkbox" />
          I agree to the terms
        </Label>
      </form>
    );
    
    const nameLabel = screen.getByText('Name');
    const emailLabel = screen.getByText('Email');
    const agreeLabel = screen.getByText('I agree to the terms');
    
    const nameInput = screen.getByRole('textbox', { name: 'Name' });
    const emailInput = screen.getByRole('textbox', { name: 'Email' });
    const checkbox = screen.getByRole('checkbox');
    
    // Test label clicks focus appropriate inputs
    await user.click(nameLabel);
    expect(document.activeElement).toBe(nameInput);
    
    await user.click(emailLabel);
    expect(document.activeElement).toBe(emailInput);
    
    await user.click(agreeLabel);
    expect(checkbox).toBeChecked();
  });

  it('should handle peer states correctly', () => {
    render(
      <div>
        <Label htmlFor="disabled-input" data-testid="label">
          Disabled Input Label
        </Label>
        <input id="disabled-input" disabled className="peer" />
      </div>
    );
    
    const label = screen.getByTestId('label');
    expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70');
  });

  it('should work with different input types', async () => {
    const user = userEvent.setup();
    
    render(
      <div>
        <Label htmlFor="text-input">Text Input</Label>
        <input id="text-input" type="text" />
        
        <Label htmlFor="number-input">Number Input</Label>
        <input id="number-input" type="number" />
        
        <Label htmlFor="date-input">Date Input</Label>
        <input id="date-input" type="date" />
        
        <Label htmlFor="file-input">File Input</Label>
        <input id="file-input" type="file" />
      </div>
    );
    
    const textLabel = screen.getByText('Text Input');
    const textInput = screen.getByRole('textbox', { name: 'Text Input' });
    
    await user.click(textLabel);
    expect(document.activeElement).toBe(textInput);
    
    const numberLabel = screen.getByText('Number Input');
    const numberInput = screen.getByRole('spinbutton');
    
    await user.click(numberLabel);
    expect(document.activeElement).toBe(numberInput);
  });

  it('should support nested content', () => {
    render(
      <div>
        <Label htmlFor="complex-input">
          <span>Required</span>
          <strong>Field Name</strong>
          <em>(with description)</em>
        </Label>
        <input id="complex-input" type="text" />
      </div>
    );
    
    const label = screen.getByText('Required');
    const strong = screen.getByText('Field Name');
    const em = screen.getByText('(with description)');
    
    expect(label).toBeInTheDocument();
    expect(strong).toBeInTheDocument();
    expect(em).toBeInTheDocument();
    
    // Check that the input is properly associated with the complex label
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveAttribute('id', 'complex-input');
  });

  it('should handle accessibility attributes', () => {
    render(
      <Label
        htmlFor="accessible-input"
        aria-describedby="input-description"
        data-testid="accessible-label"
      >
        Accessible Label
      </Label>
    );
    
    const label = screen.getByTestId('accessible-label');
    expect(label).toHaveAttribute('aria-describedby', 'input-description');
  });

  it('should work with textarea elements', async () => {
    const user = userEvent.setup();
    
    render(
      <div>
        <Label htmlFor="message">Message</Label>
        <textarea id="message" rows={4} />
      </div>
    );
    
    const label = screen.getByText('Message');
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    
    await user.click(label);
    expect(document.activeElement).toBe(textarea);
  });

  it('should work with select elements', async () => {
    const user = userEvent.setup();
    
    render(
      <div>
        <Label htmlFor="country">Country</Label>
        <select id="country">
          <option value="us">United States</option>
          <option value="ca">Canada</option>
        </select>
      </div>
    );
    
    const label = screen.getByText('Country');
    const select = screen.getByRole('combobox', { name: 'Country' });
    
    await user.click(label);
    expect(document.activeElement).toBe(select);
  });

  it('should maintain styling consistency', () => {
    render(
      <div>
        <Label className="text-red-500">Error Label</Label>
        <Label className="text-green-500">Success Label</Label>
        <Label>Default Label</Label>
      </div>
    );
    
    const errorLabel = screen.getByText('Error Label');
    const successLabel = screen.getByText('Success Label');
    const defaultLabel = screen.getByText('Default Label');
    
    expect(errorLabel).toHaveClass('text-red-500');
    expect(successLabel).toHaveClass('text-green-500');
    
    // All should have base classes
    [errorLabel, successLabel, defaultLabel].forEach(label => {
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none');
    });
  });

  it('should handle long text content', () => {
    const longText = 'This is a very long label text that might wrap to multiple lines and should still maintain proper styling and functionality';
    
    render(<Label>{longText}</Label>);
    
    const label = screen.getByText(longText);
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('leading-none'); // Should maintain line height
  });
});
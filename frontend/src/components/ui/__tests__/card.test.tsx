import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../card';

describe('Card Components', () => {
  describe('Card', () => {
    it('should render with default classes', () => {
      render(<Card data-testid="card">Card content</Card>);
      
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass(
        'rounded-lg',
        'border',
        'bg-card',
        'text-card-foreground',
        'shadow-sm'
      );
    });

    it('should accept custom className', () => {
      render(<Card className="custom-class" data-testid="card">Content</Card>);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('rounded-lg'); // Should still have default classes
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<Card ref={ref}>Card content</Card>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.textContent).toBe('Card content');
    });

    it('should accept HTML attributes', () => {
      render(<Card id="test-card" role="region">Content</Card>);
      
      const card = screen.getByRole('region');
      expect(card).toHaveAttribute('id', 'test-card');
    });
  });

  describe('CardHeader', () => {
    it('should render with default classes', () => {
      render(<CardHeader data-testid="card-header">Header content</CardHeader>);
      
      const header = screen.getByTestId('card-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass(
        'flex',
        'flex-col',
        'space-y-1.5',
        'p-6'
      );
    });

    it('should accept custom className', () => {
      render(<CardHeader className="custom-header" data-testid="header">Header</CardHeader>);
      
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('custom-header');
      expect(header).toHaveClass('flex', 'flex-col');
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<CardHeader ref={ref}>Header content</CardHeader>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardTitle', () => {
    it('should render as h3 with default classes', () => {
      render(<CardTitle>Card Title</CardTitle>);
      
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toBeInTheDocument();
      expect(title.textContent).toBe('Card Title');
      expect(title).toHaveClass(
        'text-2xl',
        'font-semibold',
        'leading-none',
        'tracking-tight'
      );
    });

    it('should accept custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>);
      
      const title = screen.getByRole('heading');
      expect(title).toHaveClass('custom-title');
      expect(title).toHaveClass('text-2xl', 'font-semibold');
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLHeadingElement>();
      
      render(<CardTitle ref={ref}>Title</CardTitle>);
      
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
      expect(ref.current?.tagName).toBe('H3');
    });
  });

  describe('CardDescription', () => {
    it('should render as paragraph with default classes', () => {
      render(<CardDescription>Card description text</CardDescription>);
      
      const description = screen.getByText('Card description text');
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe('P');
      expect(description).toHaveClass(
        'text-sm',
        'text-muted-foreground'
      );
    });

    it('should accept custom className', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>);
      
      const description = screen.getByText('Description');
      expect(description).toHaveClass('custom-desc');
      expect(description).toHaveClass('text-sm');
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      
      render(<CardDescription ref={ref}>Description</CardDescription>);
      
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
    });
  });

  describe('CardContent', () => {
    it('should render with default classes', () => {
      render(<CardContent data-testid="content">Content here</CardContent>);
      
      const content = screen.getByTestId('content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('should accept custom className', () => {
      render(<CardContent className="custom-content" data-testid="content">Content</CardContent>);
      
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('custom-content');
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<CardContent ref={ref}>Content</CardContent>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('CardFooter', () => {
    it('should render with default classes', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>);
      
      const footer = screen.getByTestId('footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass(
        'flex',
        'items-center',
        'p-6',
        'pt-0'
      );
    });

    it('should accept custom className', () => {
      render(<CardFooter className="custom-footer" data-testid="footer">Footer</CardFooter>);
      
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('custom-footer');
      expect(footer).toHaveClass('flex', 'items-center');
    });

    it('should forward refs correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Card composition', () => {
    it('should render complete card structure', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>This is a test card description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>This is the main content of the card.</p>
          </CardContent>
          <CardFooter>
            <button>Action Button</button>
          </CardFooter>
        </Card>
      );

      const card = screen.getByTestId('full-card');
      const title = screen.getByRole('heading', { name: 'Test Card' });
      const description = screen.getByText('This is a test card description');
      const content = screen.getByText('This is the main content of the card.');
      const actionButton = screen.getByRole('button', { name: 'Action Button' });

      expect(card).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(actionButton).toBeInTheDocument();

      // Verify hierarchy
      expect(card).toContainElement(title);
      expect(card).toContainElement(description);
      expect(card).toContainElement(content);
      expect(card).toContainElement(actionButton);
    });

    it('should handle nested card structure correctly', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Main Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Card data-testid="nested-card">
              <CardContent>
                <p>Nested card content</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      );

      const mainTitle = screen.getByText('Main Title');
      const nestedCard = screen.getByTestId('nested-card');
      const nestedContent = screen.getByText('Nested card content');

      expect(mainTitle).toBeInTheDocument();
      expect(nestedCard).toBeInTheDocument();
      expect(nestedContent).toBeInTheDocument();
    });

    it('should maintain proper semantic structure', () => {
      render(
        <Card role="article">
          <CardHeader>
            <CardTitle>Article Title</CardTitle>
            <CardDescription>Article subtitle</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Article content goes here.</p>
          </CardContent>
        </Card>
      );

      const article = screen.getByRole('article');
      const heading = screen.getByRole('heading', { level: 3 });

      expect(article).toBeInTheDocument();
      expect(heading).toBeInTheDocument();
      expect(article).toContainElement(heading);
    });
  });

  describe('Accessibility', () => {
    it('should support ARIA attributes', () => {
      render(
        <Card 
          role="region"
          aria-labelledby="card-title"
          data-testid="accessible-card"
        >
          <CardHeader>
            <CardTitle id="card-title">Accessible Card</CardTitle>
          </CardHeader>
          <CardContent>
            Content with proper labeling
          </CardContent>
        </Card>
      );

      const card = screen.getByRole('region');
      const title = screen.getByRole('heading');

      expect(card).toHaveAttribute('aria-labelledby', 'card-title');
      expect(title).toHaveAttribute('id', 'card-title');
    });

    it('should maintain focus management', () => {
      render(
        <Card tabIndex={0} data-testid="focusable-card">
          <CardContent>Focusable card content</CardContent>
        </Card>
      );

      const card = screen.getByTestId('focusable-card');
      
      card.focus();
      expect(document.activeElement).toBe(card);
    });
  });
});
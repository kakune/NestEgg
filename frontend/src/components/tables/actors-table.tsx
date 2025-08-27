'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Actor, ActorKind } from '@/types/transaction';
import { apiHelpers } from '@/lib/api-client';
import { toast } from 'sonner';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Plus, 
  User, 
  CreditCard,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface ActorsTableProps {
  onEditActor: (actor: Actor) => void;
  onCreateActor: () => void;
}

export function ActorsTable({ onEditActor, onCreateActor }: ActorsTableProps) {
  const queryClient = useQueryClient();

  const { data: actors = [], isLoading, error } = useQuery({
    queryKey: ['actors'],
    queryFn: async () => {
      const response = await apiHelpers.getActors();
      return response.data.data || response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive: boolean } }) =>
      apiHelpers.updateActor(id, data),
    onSuccess: (_, variables) => {
      toast.success(`Actor ${variables.data.isActive ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['actors'] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to update actor';
      toast.error(errorMessage || 'Failed to update actor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiHelpers.deleteActor,
    onSuccess: () => {
      toast.success('Actor deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['actors'] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error 
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Failed to delete actor';
      toast.error(errorMessage || 'Failed to delete actor');
    },
  });

  const handleToggleActive = (actor: Actor) => {
    const action = actor.isActive ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} "${actor.name}"?`)) {
      updateMutation.mutate({
        id: actor.id,
        data: { isActive: !actor.isActive },
      });
    }
  };

  const handleDeleteActor = (actor: Actor) => {
    if (confirm(`Are you sure you want to delete "${actor.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(actor.id);
    }
  };

  const getActorIcon = (kind: ActorKind) => {
    return kind === ActorKind.USER ? (
      <User className="h-4 w-4 text-blue-600" />
    ) : (
      <CreditCard className="h-4 w-4 text-green-600" />
    );
  };

  const getActorTypeLabel = (kind: ActorKind) => {
    return kind === ActorKind.USER ? 'User' : 'Instrument';
  };

  // Separate actors by type
  const userActors = actors.filter((actor: Actor) => actor.kind === ActorKind.USER);
  const instrumentActors = actors.filter((actor: Actor) => actor.kind === ActorKind.INSTRUMENT);

  const renderActorRow = (actor: Actor) => (
    <TableRow key={actor.id}>
      <TableCell>
        <div className="flex items-center gap-3">
          {getActorIcon(actor.kind)}
          <div>
            <div className="font-medium">{actor.name}</div>
            {actor.user && (
              <div className="text-sm text-muted-foreground">
                {actor.user.name} ({actor.user.email})
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1">
          {getActorIcon(actor.kind)}
          {getActorTypeLabel(actor.kind)}
        </span>
      </TableCell>
      <TableCell>
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
          actor.isActive 
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {actor.isActive ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(actor.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditActor(actor)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleActive(actor)}>
              {actor.isActive ? (
                <>
                  <ToggleLeft className="mr-2 h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteActor(actor)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Loading actors...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-destructive">Error loading actors</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Actors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            User Actors
          </CardTitle>
          <Button onClick={onCreateActor} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Actor
          </Button>
        </CardHeader>
        <CardContent>
          {userActors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userActors.map(renderActorRow)}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No user actors found</p>
              <p className="text-sm text-muted-foreground">
                User actors represent household members who make transactions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instrument Actors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            Instrument Actors
          </CardTitle>
          <Button onClick={onCreateActor} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Actor
          </Button>
        </CardHeader>
        <CardContent>
          {instrumentActors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instrumentActors.map(renderActorRow)}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No instrument actors found</p>
              <p className="text-sm text-muted-foreground">
                Instrument actors represent payment methods like credit cards, wallets, or bank accounts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Actor Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userActors.length}</div>
              <div className="text-sm text-muted-foreground">User Actors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{instrumentActors.length}</div>
              <div className="text-sm text-muted-foreground">Instrument Actors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {actors.filter((a: Actor) => a.isActive).length}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {actors.filter((a: Actor) => !a.isActive).length}
              </div>
              <div className="text-sm text-muted-foreground">Inactive</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
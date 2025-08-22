import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { farmApi, type CreateFarmRequest } from '../api/farms';

interface FarmCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: Array<{ lat: number; lon: number }>;
  onFarmCreated?: (farm: any) => void;
  onError?: (error: string) => void;
}

export function FarmCreationDialog({
  open,
  onOpenChange,
  coordinates,
  onFarmCreated,
  onError,
}: FarmCreationDialogProps) {
  const [farmName, setFarmName] = useState('');
  const [farmDescription, setFarmDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!farmName.trim()) {
      setError('Farm name is required');
      return;
    }

    if (coordinates.length < 3) {
      setError('At least 3 coordinates are required to create a farm');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Convert coordinates to the format expected by the API: [[lat, lon], [lat, lon], ...]
      const coords = coordinates.map(coord => [coord.lat, coord.lon]);
      
      const farmData: CreateFarmRequest = {
        name: farmName.trim(),
        coords: coords,
      };

      console.log('Creating farm with data:', farmData);
      
      const newFarm = await farmApi.createFarm(farmData);
      
      console.log('Farm created successfully:', newFarm);
      
      // Reset form
      setFarmName('');
      setFarmDescription('');
      setError(null);
      
      // Close dialog
      onOpenChange(false);
      
      // Notify parent component
      if (onFarmCreated) {
        onFarmCreated(newFarm);
      }
    } catch (err: any) {
      console.error('Error creating farm:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create farm';
      setError(errorMessage);
      
      // Also call the onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setFarmName('');
    setFarmDescription('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Farm</DialogTitle>
          <DialogDescription>
            Enter details for your new farm. The farm boundary has been drawn on the map.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="farm-name">Farm Name *</Label>
            <Input
              id="farm-name"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="Enter farm name (e.g., North Field)"
              disabled={isCreating}
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="farm-description">Description (Optional)</Label>
            <Textarea
              id="farm-description"
              value={farmDescription}
              onChange={(e) => setFarmDescription(e.target.value)}
              placeholder="Add any additional details about this farm..."
              rows={3}
              disabled={isCreating}
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Farm Boundaries</Label>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
              <div className="font-medium">Coordinates ({coordinates.length} points):</div>
              <div className="mt-1 max-h-24 overflow-y-auto">
                {coordinates.map((coord, index) => (
                  <div key={index} className="text-xs">
                    Point {index + 1}: {coord.lat.toFixed(6)}, {coord.lon.toFixed(6)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isCreating || !farmName.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Farm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

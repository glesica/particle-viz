# Input Format

This document describes the input formats accepted by the visualization system.

## JSON Format

    {
        states: [{
            t: <int>,
            id: <any>,
            x: <float>,
            y: <float>,
            z: <float>,
            r: <float>
        }, ...]
    }

Where:

  * t = current time step (integer)
  * id = particle id, can be anything unique
  * x, y, z = coordinates (floats)
  * r = particle radius (float)

The `states` attribute should be a list of particle states. There need not be
any particle order imposed, all states with a given value of `t` will be
rendered in the same frame.

The system will try to guess a good camera position given the list of states.

## CSV Format

This might be implemented later.

    <t>, <pid>, <x>, <y>, <z>, <r>

Where:

  * t = current time step (integer)
  * pid = particle id, can be anything unique
  * x, y, z = coordinates (floats)
  * r = particle radius (float)

The states will be played back from the lowest to the highest value of `t`. The
rows of the CSV file need not be in order.

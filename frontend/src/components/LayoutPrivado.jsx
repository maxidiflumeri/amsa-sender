import { Box } from '@mui/material';
import Navbar from './NavBar';
import { Outlet } from 'react-router-dom';

const LayoutPrivado = ({ mode, toggleTheme }) => {
    return (
        <Navbar mode={mode} toggleTheme={toggleTheme}>
            <Outlet />
        </Navbar>
    );
};

export default LayoutPrivado;
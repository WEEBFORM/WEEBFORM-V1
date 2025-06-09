import { useContext } from 'react';
import SocketContext from '../contexts/socketContext';

const useSocket = () => {
    return useContext(SocketContext);
};

export default useSocket;
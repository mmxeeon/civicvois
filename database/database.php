
<?php
class DataBase
{
    public static function getConnection()
    {
        $host = 'localhost';
        $user = 'root';
        $pass = '';
        $dbname = 'civicvoice';
        return new mysqli($host, $user, $pass, $dbname);
    }
}
?>